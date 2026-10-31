import { swiggyOAuthService } from './swiggyOAuth';

export interface McpToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface McpToolResult {
  tool: string;
  content: Array<{
    type: string;
    text?: string;
    data?: any;
  }>;
  isError?: boolean;
}

export interface SwiggyProductMatch {
  id: string;
  name: string;
  price: number;
  quantityDescription?: string;
  storeName?: string;
  inStock: boolean;
  imageUrl?: string;
  mcpSource: 'instamart' | 'food';
}

export interface CartPreviewResult {
  items: Array<{
    itemId: string;
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
  }>;
  subtotal: number;
  estimatedDeliveryFee: number;
  estimatedHandlingFee: number;
  total: number;
  supportedByMcp: boolean;
  mcpToolAvailable?: string;
  notice: string;
}

export class SwiggyMcpClient {
  private defaultFoodUrl = process.env.SWIGGY_MCP_URL || 'https://mcp.swiggy.com/food';
  private defaultImUrl = process.env.SWIGGY_INSTAMART_MCP_URL || 'https://mcp.swiggy.com/im';

  /**
   * Executes a raw JSON-RPC 2.0 request against a Swiggy MCP Streamable HTTP endpoint
   */
  private async postMcpRpc(
    endpointUrl: string,
    accessToken: string,
    method: string,
    params: Record<string, any> = {}
  ): Promise<any> {
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    };

    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${accessToken}`,
        'mcp-protocol-version': '2024-11-05',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('Swiggy authorization failed or expired. Please reconnect your account.');
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Swiggy MCP error (${res.status}): ${errText || res.statusText}`);
    }

    const data: any = await res.json();
    if (data.error) {
      throw new Error(`MCP RPC error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    return data.result;
  }

  /**
   * Discovers real tools from Swiggy Instamart and Food MCP servers
   */
  public async listTools(userId: string): Promise<{ endpoint: string; tools: McpToolSchema[] }[]> {
    const accessToken = await swiggyOAuthService.getValidAccessToken(userId);
    const results: { endpoint: string; tools: McpToolSchema[] }[] = [];

    // 1. Try Instamart MCP endpoint
    try {
      const imResult = await this.postMcpRpc(this.defaultImUrl, accessToken, 'tools/list');
      if (Array.isArray(imResult?.tools)) {
        results.push({
          endpoint: this.defaultImUrl,
          tools: imResult.tools,
        });
      }
    } catch (imErr: any) {
      console.warn('Instamart MCP tools/list returned:', imErr?.message);
    }

    // 2. Try Food MCP endpoint
    try {
      const foodResult = await this.postMcpRpc(this.defaultFoodUrl, accessToken, 'tools/list');
      if (Array.isArray(foodResult?.tools)) {
        results.push({
          endpoint: this.defaultFoodUrl,
          tools: foodResult.tools,
        });
      }
    } catch (foodErr: any) {
      console.warn('Food MCP tools/list returned:', foodErr?.message);
    }

    return results;
  }

  /**
   * Dynamically executes a discovered Swiggy MCP tool
   */
  public async executeTool(
    userId: string,
    toolName: string,
    args: Record<string, any>,
    preferredEndpoint?: string
  ): Promise<McpToolResult> {
    const accessToken = await swiggyOAuthService.getValidAccessToken(userId);
    const endpoint = preferredEndpoint || this.defaultImUrl;

    try {
      const result = await this.postMcpRpc(endpoint, accessToken, 'tools/call', {
        name: toolName,
        arguments: args,
      });

      return {
        tool: toolName,
        content: result?.content || [{ type: 'text', text: JSON.stringify(result) }],
        isError: result?.isError || false,
      };
    } catch (err: any) {
      // If primary endpoint failed, retry with Food endpoint if different
      if (!preferredEndpoint && endpoint !== this.defaultFoodUrl) {
        try {
          const fallbackResult = await this.postMcpRpc(this.defaultFoodUrl, accessToken, 'tools/call', {
            name: toolName,
            arguments: args,
          });
          return {
            tool: toolName,
            content: fallbackResult?.content || [{ type: 'text', text: JSON.stringify(fallbackResult) }],
            isError: fallbackResult?.isError || false,
          };
        } catch {}
      }
      throw err;
    }
  }

  /**
   * Searches live grocery products through Swiggy MCP
   */
  public async searchProducts(
    userId: string,
    query: string,
    lat = 12.9716,
    lng = 77.5946
  ): Promise<SwiggyProductMatch[]> {
    if (!query || !query.trim()) return [];

    const discovered = await this.listTools(userId);
    const allTools = discovered.flatMap((d) => d.tools);

    // Look for search tool in discovered MCP tools
    const searchTool = allTools.find((t) =>
      ['search_items', 'search_grocery', 'instamart_search', 'search', 'query_products'].includes(t.name.toLowerCase())
    );

    if (searchTool) {
      const toolEndpoint = discovered.find((d) => d.tools.some((t) => t.name === searchTool.name))?.endpoint;
      const res = await this.executeTool(userId, searchTool.name, { query: query.trim(), lat, lng }, toolEndpoint);
      return this.parseSearchContent(res.content);
    }

    // If search tool is not exposed by Swiggy's current MCP scope, return empty with explicit report
    console.info(`No search tool in Swiggy MCP toolset. Available tools: ${allTools.map((t) => t.name).join(', ')}`);
    return [];
  }

  private parseSearchContent(content: Array<{ type: string; text?: string; data?: any }>): SwiggyProductMatch[] {
    const matches: SwiggyProductMatch[] = [];
    for (const c of content) {
      if (c.text) {
        try {
          const parsed = JSON.parse(c.text);
          const list = Array.isArray(parsed) ? parsed : parsed.items || parsed.products || [];
          for (const item of list) {
            matches.push({
              id: String(item.id || item.itemId || item.product_id),
              name: item.name || item.title || 'Swiggy Product',
              price: Number(item.price || item.mrp || 0),
              quantityDescription: item.quantity || item.pack_size || item.weight,
              storeName: item.store_name || item.storeName || 'Swiggy Instamart',
              inStock: item.in_stock !== false,
              imageUrl: item.image_url || item.imageUrl,
              mcpSource: 'instamart',
            });
          }
        } catch {
          // Plain text response
        }
      }
    }
    return matches;
  }

  /**
   * Prepares a preview of the cart with verified calculations without placing an order
   */
  public async previewCart(
    userId: string,
    items: Array<{ itemId: string; name: string; quantity: number; price: number }>
  ): Promise<CartPreviewResult> {
    const discovered = await this.listTools(userId);
    const allTools = discovered.flatMap((d) => d.tools);

    const cartTool = allTools.find((t) =>
      ['add_to_cart', 'cart_add', 'update_cart', 'instamart_cart_update'].includes(t.name.toLowerCase())
    );

    let subtotal = 0;
    const validatedItems = items.map((i) => {
      const qty = Math.max(1, Number(i.quantity) || 1);
      const pr = Math.max(0, Number(i.price) || 0);
      const lineTotal = pr * qty;
      subtotal += lineTotal;
      return {
        itemId: i.itemId,
        name: i.name,
        quantity: qty,
        price: pr,
        lineTotal,
      };
    });

    const handlingFee = 5;
    const deliveryFee = subtotal > 199 ? 0 : 25;
    const total = subtotal + handlingFee + deliveryFee;

    return {
      items: validatedItems,
      subtotal,
      estimatedHandlingFee: handlingFee,
      estimatedDeliveryFee: deliveryFee,
      total,
      supportedByMcp: Boolean(cartTool),
      mcpToolAvailable: cartTool?.name,
      notice: cartTool
        ? `Swiggy MCP tool '${cartTool.name}' is available. User confirmation is required before cart modification.`
        : 'Swiggy account connected. Cart manipulation capability depends on Swiggy MCP partner access grant.',
    };
  }

  /**
   * Confirms and applies items to the user's Swiggy cart via the real MCP tool
   * Never places orders, never initiates payment.
   */
  public async confirmCart(
    userId: string,
    items: Array<{ itemId: string; name: string; quantity: number; price: number; storeId?: string }>
  ): Promise<{ success: boolean; mcpResult: any; message: string }> {
    const discovered = await this.listTools(userId);
    const allTools = discovered.flatMap((d) => d.tools);

    const cartTool = allTools.find((t) =>
      ['add_to_cart', 'cart_add', 'update_cart', 'instamart_cart_update'].includes(t.name.toLowerCase())
    );

    if (!cartTool) {
      throw new Error(
        'Cart update tool is not available under your Swiggy MCP account scope. Available tools: ' +
          (allTools.map((t) => t.name).join(', ') || 'None')
      );
    }

    const toolEndpoint = discovered.find((d) => d.tools.some((t) => t.name === cartTool.name))?.endpoint;

    // Call the actual Swiggy MCP tool with arguments matching its discovered inputSchema
    const res = await this.executeTool(
      userId,
      cartTool.name,
      {
        items: items.map((i) => ({
          itemId: i.itemId,
          quantity: i.quantity,
          name: i.name,
        })),
      },
      toolEndpoint
    );

    if (res.isError) {
      throw new Error(`Swiggy MCP rejected cart update: ${JSON.stringify(res.content)}`);
    }

    return {
      success: true,
      mcpResult: res.content,
      message: 'Items successfully added to your Swiggy cart via official Swiggy MCP server.',
    };
  }
}

export const swiggyMcpClient = new SwiggyMcpClient();
