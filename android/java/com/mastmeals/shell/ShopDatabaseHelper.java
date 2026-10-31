package com.mastmeals.shell;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.util.ArrayList;
import java.util.List;

/**
 * SQLite helper for queuing offline shop messages when the Express server is unreachable.
 */
public class ShopDatabaseHelper extends SQLiteOpenHelper {

    private static final String DATABASE_NAME = "shop_inbox.db";
    private static final int DATABASE_VERSION = 1;

    public static final String TABLE_MESSAGES = "shop_messages";
    public static final String COL_ID = "_id";
    public static final String COL_SOURCE = "source";
    public static final String COL_SENDER = "sender";
    public static final String COL_TEXT = "text";
    public static final String COL_TIMESTAMP = "timestamp";
    public static final String COL_SYNCED = "synced";
    public static final String COL_CREATED_AT = "created_at";

    public static class QueuedMessage {
        public long id;
        public String source;
        public String sender;
        public String text;
        public long timestamp;
        public boolean synced;
    }

    private static ShopDatabaseHelper instance;

    public static synchronized ShopDatabaseHelper getInstance(Context context) {
        if (instance == null) {
            instance = new ShopDatabaseHelper(context.getApplicationContext());
        }
        return instance;
    }

    private ShopDatabaseHelper(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        String sql = "CREATE TABLE " + TABLE_MESSAGES + " ("
                + COL_ID + " INTEGER PRIMARY KEY AUTOINCREMENT, "
                + COL_SOURCE + " TEXT NOT NULL, "
                + COL_SENDER + " TEXT NOT NULL, "
                + COL_TEXT + " TEXT NOT NULL, "
                + COL_TIMESTAMP + " INTEGER NOT NULL, "
                + COL_SYNCED + " INTEGER NOT NULL DEFAULT 0, "
                + COL_CREATED_AT + " INTEGER NOT NULL"
                + ");";
        db.execSQL(sql);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_MESSAGES);
        onCreate(db);
    }

    public synchronized long insertMessage(String source, String sender, String text, long timestamp) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put(COL_SOURCE, source);
        cv.put(COL_SENDER, sender);
        cv.put(COL_TEXT, text);
        cv.put(COL_TIMESTAMP, timestamp);
        cv.put(COL_SYNCED, 0);
        cv.put(COL_CREATED_AT, System.currentTimeMillis());
        return db.insert(TABLE_MESSAGES, null, cv);
    }

    public synchronized List<QueuedMessage> getUnsyncedMessages() {
        List<QueuedMessage> list = new ArrayList<>();
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.query(TABLE_MESSAGES, null, COL_SYNCED + " = 0", null, null, null, COL_ID + " ASC");
        if (c != null) {
            try {
                while (c.moveToNext()) {
                    QueuedMessage m = new QueuedMessage();
                    m.id = c.getLong(c.getColumnIndexOrThrow(COL_ID));
                    m.source = c.getString(c.getColumnIndexOrThrow(COL_SOURCE));
                    m.sender = c.getString(c.getColumnIndexOrThrow(COL_SENDER));
                    m.text = c.getString(c.getColumnIndexOrThrow(COL_TEXT));
                    m.timestamp = c.getLong(c.getColumnIndexOrThrow(COL_TIMESTAMP));
                    m.synced = c.getInt(c.getColumnIndexOrThrow(COL_SYNCED)) == 1;
                    list.add(m);
                }
            } finally {
                c.close();
            }
        }
        return list;
    }

    public synchronized void markSynced(long id) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put(COL_SYNCED, 1);
        db.update(TABLE_MESSAGES, cv, COL_ID + " = ?", new String[]{String.valueOf(id)});
    }

    public synchronized int getUnsyncedCount() {
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT COUNT(*) FROM " + TABLE_MESSAGES + " WHERE " + COL_SYNCED + " = 0", null);
        int count = 0;
        if (c != null) {
            try {
                if (c.moveToFirst()) {
                    count = c.getInt(0);
                }
            } finally {
                c.close();
            }
        }
        return count;
    }
}
