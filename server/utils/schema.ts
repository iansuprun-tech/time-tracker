import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // null = входить нельзя: так живут аккаунты, заведённые до появления входа
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Дружба взаимная: одна строка читается в обе стороны. status: pending | accepted */
export const friendships = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    requesterId: integer("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    addresseeId: integer("addressee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("friendships_pair_idx").on(t.requesterId, t.addresseeId),
    index("friendships_addressee_idx").on(t.addresseeId, t.status),
  ],
);

/** status: draft | started | finished */
export const days = pgTable(
  "days",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    date: date("date").notNull(),
    status: text("status").notNull().default("draft"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    mood: integer("mood"),
    dayNote: text("day_note"),
  },
  (t) => [index("days_user_date_idx").on(t.userId, t.date)],
);

/** status: todo | doing | done | dropped | blocked */
export const blocks = pgTable(
  "blocks",
  {
    id: serial("id").primaryKey(),
    dayId: integer("day_id").notNull().references(() => days.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category"),
    plannedMin: integer("planned_min"),
    actualMin: integer("actual_min"),
    status: text("status").notNull().default("todo"),
    isUnplanned: boolean("is_unplanned").notNull().default(false),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("blocks_day_idx").on(t.dayId)],
);

/** endedAt null = таймер идёт прямо сейчас */
export const timeEntries = pgTable(
  "time_entries",
  {
    id: serial("id").primaryKey(),
    blockId: integer("block_id").notNull().references(() => blocks.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [index("time_entries_block_idx").on(t.blockId)],
);

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").references(() => blocks.id, { onDelete: "cascade" }),
  dayId: integer("day_id").references(() => days.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id),
  text: text("text").notNull(),
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** соцчасть вне MVP, таблица заложена заранее. targetType: day | block */
export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: integer("target_id").notNull(),
    authorId: integer("author_id").notNull().references(() => users.id),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_target_idx").on(t.targetType, t.targetId)],
);

/** Приглашение по ссылке: одноразовое, со сроком жизни */
export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  inviterId: integer("inviter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedById: integer("used_by_id").references(() => users.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at", { withTimezone: true }),
});
