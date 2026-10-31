import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { swiggyOAuthService } from './swiggyOAuth';
import { swiggyTokenStore } from './swiggyTokenStore';

export interface McpToolSchema {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
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

export interface AddressMilestoneResult {
  tool: string;
  calledAt: string;
  success: boolean;
  summary: string;
  addressCount: number;
  maskedAddresses: Array<{
    id?: string;
    label?: string; // e.g. Home, Work, Other
    city?: string;
    area?: string;
  }>;
  rawResponse?: any;
  error?: string;
}

export class SwiggyMcpClient {
  private defaultFoodUrl = process.env.SWIGGY_MCP_URL || 'https://mcp.swiggy.com/food';
  private defaultImUrl = process.env.SWIGGY_INSTAMART_MCP_URL || 'https://mcp.swiggy.com/im';

  /**
   * Creates an authenticated MCP Client with Streamable HTTP transport
   * using the official @modelcontextprotocol/sdk
   */
  private async createConnectedClient(
    endpointUrl: string,
    accessToken: string
  ): Promise<{ client: Client; transport: StreamableHTTPClientTransport }> {
    const transport = new StreamableHTTPClientTransport(new URL(endpointUrl), {
      requestInit: {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json, text/event-stream',
        },
      },
    });

    const client = new Client(
      {
        name: 'KitchenSync',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
    return { client, transport };
  }

  /**
   * Milestone 4: Call get_addresses on Swiggy Food MCP server.
   * Calls:
   *   const result = await client.callTool({
   *     name: "get_addresses",
   *     arguments: {},
   *   });
   * Displays the actual response in application and backend logs, without exposing sensitive information.
   */
  public async callGetAddresses(userId: string): Promise<AddressMilestoneResult> {
    const accessToken = await swiggyOAuthService.getValidAccessToken(userId);
    console.log(`[Swiggy MCP] Executing first tool call 'get_addresses' for user: ${userId}`);

    let client: Client | null = null;
    let transport: StreamableHTTPClientTransport | null = null;

    try {
      const conn = await this.createConnectedClient(this.defaultFoodUrl, accessToken);
      client = conn.client;
      transport = conn.transport;

      // Official Milestone 4 Tool Call
      const result: any = await client.callTool({
        name: 'get_addresses',
        arguments: {},
      });

      console.log('[Swiggy MCP] Raw get_addresses call completed:', {
        isError: result.isError,
        contentCount: result.content?.length,
      });

      // Parse and sanitize response without exposing sensitive PII (phone number, house number)
      const maskedAddresses: Array<{ id?: string; label?: string; city?: string; area?: string }> = [];
      let rawText = '';

      if (Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === 'text' && item.text) {
            rawText += item.text;
            try {
              const parsed = JSON.parse(item.text);
              const list = Array.isArray(parsed) ? parsed : parsed.addresses || parsed.data || [];
              for (const addr of list) {
                maskedAddresses.push({
                  id: addr.id || addr.address_id ? String(addr.id || addr.address_id).slice(0, 6) + '...' : undefined,
                  label: addr.address_alias || addr.tag || addr.type || addr.label || 'Saved Address',
                  city: addr.city || addr.cityName,
                  area: addr.area || addr.landmark,
                });
              }
            } catch {
              // text content was not JSON, extract count if possible
            }
          }
        }
      }

      const addressCount = maskedAddresses.length;
      const summary = addressCount > 0
        ? `Successfully retrieved ${addressCount} saved address(es) from Swiggy account.`
        : 'Tool call get_addresses succeeded (0 saved addresses found in account).';

      console.log(`[Swiggy MCP] Sanitized address summary: ${summary}`, maskedAddresses);

      // Update user profile in token store with customer name or address info if available
      const tokens = swiggyTokenStore.getTokens(userId);
      if (tokens) {
        if (!tokens.userProfile?.name || tokens.userProfile.name === 'Swiggy Member') {
          const areaLabel = maskedAddresses[0]?.area || maskedAddresses[0]?.city;
          tokens.userProfile = {
            ...tokens.userProfile,
            name: areaLabel ? `Swiggy User (${areaLabel})` : 'Swiggy User',
          };
        }
      }

      const milestoneResult: AddressMilestoneResult = {
        tool: 'get_addresses',
        calledAt: new Date().toISOString(),
        success: true,
        summary,
        addressCount,
        maskedAddresses,
      };

      swiggyTokenStore.saveFirstToolCallResult(userId, {
        tool: 'get_addresses',
        calledAt: milestoneResult.calledAt,
        success: true,
        summary,
        addressCount,
      });

      return milestoneResult;
    } catch (err: any) {
      console.error('[Swiggy MCP] get_addresses call failed:', err?.message || err);
      const milestoneResult: AddressMilestoneResult = {
        tool: 'get_addresses',
        calledAt: new Date().toISOString(),
        success: false,
        summary: `get_addresses call failed: ${err?.message || 'Transport error'}`,
        addressCount: 0,
        maskedAddresses: [],
        error: err?.message || 'Execution error',
      };

      swiggyTokenStore.saveFirstToolCallResult(userId, {
        tool: 'get_addresses',
        calledAt: milestoneResult.calledAt,
        success: false,
        summary: milestoneResult.summary,
        error: milestoneResult.error,
      });

      return milestoneResult;
    } finally {
      if (client) {
        try {
          await client.close();
        } catch {}
      }
    }
  }

  /**
   * Milestone 5: Discover available tools from Swiggy Food and Instamart MCP servers
   * using the official SDK client.listTools().
   */
  public async listTools(userId: string): Promise<{ endpoint: string; tools: McpToolSchema[] }[]> {
    const accessToken = await swiggyOAuthService.getValidAccessToken(userId);
    const results: { endpoint: string; tools: McpToolSchema[] }[] = [];

    // 1. Food MCP Endpoint (https://mcp.swiggy.com/food)
    try {
      const conn = await this.createConnectedClient(this.defaultFoodUrl, accessToken);
      try {
        const foodList = await conn.client.listTools();
        if (Array.isArray(foodList?.tools)) {
          results.push({
            endpoint: this.defaultFoodUrl,
            tools: foodList.tools as McpToolSchema[],
          });
        }
      } finally {
        await conn.client.close();
      }
    } catch (err: any) {
      console.warn('[Swiggy MCP] Food tools/list query note:', err?.message);
    }

    // 2. Instamart MCP Endpoint (https://mcp.swiggy.com/im)
    try {
      const conn = await this.createConnectedClient(this.defaultImUrl, accessToken);
      try {
        const imList = await conn.client.listTools();
        if (Array.isArray(imList?.tools)) {
          results.push({
            endpoint: this.defaultImUrl,
            tools: imList.tools as McpToolSchema[],
          });
        }
      } finally {
        await conn.client.close();
      }
    } catch (err: any) {
      console.warn('[Swiggy MCP] Instamart tools/list query note:', err?.message);
    }

    return results;
  }

  /**
   * Dynamically executes a discovered Swiggy MCP tool using the official @modelcontextprotocol/sdk
   */
  public async executeTool(
    userId: string,
    toolName: string,
    args: Record<string, any>,
    preferredEndpoint?: string
  ): Promise<McpToolResult> {
    const accessToken = await swiggyOAuthService.getValidAccessToken(userId);
    const endpoint = preferredEndpoint || this.defaultImUrl;

    let client: Client | null = null;
    try {
      const conn = await this.createConnectedClient(endpoint, accessToken);
      client = conn.client;

      const result: any = await client.callTool({
        name: toolName,
        arguments: args,
      });

      return {
        tool: toolName,
        content: result.content || [{ type: 'text', text: JSON.stringify(result) }],
        isError: result.isError || false,
      };
    } catch (err: any) {
      // If primary endpoint failed and fallback exists, try other endpoint
      if (!preferredEndpoint && endpoint !== this.defaultFoodUrl) {
        try {
          const conn2 = await this.createConnectedClient(this.defaultFoodUrl, accessToken);
          try {
            const fallbackResult: any = await conn2.client.callTool({
              name: toolName,
              arguments: args,
            });
            return {
              tool: toolName,
              content: fallbackResult.content || [{ type: 'text', text: JSON.stringify(fallbackResult) }],
              isError: fallbackResult.isError || false,
            };
          } finally {
            await conn2.client.close();
          }
        } catch {}
      }
      throw err;
    } finally {
      if (client) {
        try {
          await client.close();
        } catch {}
      }
    }
  }

  /**
   * Live product search: Only uses tools actually discovered from MCP tools/list
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

    console.info(`[Swiggy MCP] Search tool not in active account scope. Discovered tools: ${allTools.map((t) => t.name).join(', ') || 'None'}`);
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
        } catch {}
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
        : 'Cart items prepared for preview. Cart tool execution is guarded by discovered MCP tool capability.',
    };
  }

  /**
   * Confirms and applies items to the user's Swiggy cart via real MCP tool.
   * Explicit user confirmation required. Never places orders, never initiates payment.
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
        'Cart update tool is not in your Swiggy MCP account scope. Discovered tools: ' +
          (allTools.map((t) => t.name).join(', ') || 'None')
      );
    }

    const toolEndpoint = discovered.find((d) => d.tools.some((t) => t.name === cartTool.name))?.endpoint;

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
