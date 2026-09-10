INSERT INTO lists (id, owner, title, intro, public, created_at, updated_at)
VALUES ('ten-highest-rated-bars-kw37r7', (SELECT id FROM users WHERE username = 'google-statistics' COLLATE NOCASE), 'Ten highest-rated bars', 'Google''s numbers, not mine: the ten it rates highest of the 90 bars in its Tallinn export carrying fifty reviews or more, each rating weighted by how many people left one.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT(id) DO UPDATE SET
    owner = excluded.owner,
    title = excluded.title,
    intro = excluded.intro,
    public = excluded.public,
    updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000;

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('ten-highest-rated-bars-kw37r7', 'ChIJRZlX09WTkkYR4jNT2TBAqx4', 'Toro veinikohvik', '', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-bars-kw37r7', 'ChIJsROid2OTkkYRYoRVSMnM_aI', 'Botaanik', '', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-bars-kw37r7', 'ChIJwRoMF56UkkYRMzy7XcbCCS8', 'Whisper Sister', '', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-bars-kw37r7', 'ChIJBTEaMMeTkkYRWwjQ52jxb8A', 'Veino', '', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-bars-kw37r7', 'ChIJmYxkmmOTkkYRzcADyRttgns', 'Vixen Vinoteek', '', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-bars-kw37r7', 'ChIJU0BKu4eTkkYR1ZYZ2RALid0', 'Lb23', '', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-bars-kw37r7', 'ChIJcZzHCzeVkkYRb53FeamJ6qc', 'Austerium oyster bar & wine', '', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-bars-kw37r7', 'koht', 'Koht', '', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-bars-kw37r7', 'vabrik', 'Vabrik', '', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-bars-kw37r7', 'ChIJ0-pZBIWTkkYRbcXShJ2vmhk', 'Mnemonic Bar', '', 9, CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT(list_id, place_id) DO UPDATE SET
    name = excluded.name,
    pos = excluded.pos;

DELETE FROM list_items WHERE list_id = 'ten-highest-rated-bars-kw37r7' AND place_id NOT IN (
  'ChIJRZlX09WTkkYR4jNT2TBAqx4',
  'ChIJsROid2OTkkYRYoRVSMnM_aI',
  'ChIJwRoMF56UkkYRMzy7XcbCCS8',
  'ChIJBTEaMMeTkkYRWwjQ52jxb8A',
  'ChIJmYxkmmOTkkYRzcADyRttgns',
  'ChIJU0BKu4eTkkYR1ZYZ2RALid0',
  'ChIJcZzHCzeVkkYRb53FeamJ6qc',
  'koht',
  'vabrik',
  'ChIJ0-pZBIWTkkYRbcXShJ2vmhk'
);

INSERT INTO lists (id, owner, title, intro, public, created_at, updated_at)
VALUES ('ten-highest-rated-burger-places-tbjbjk', (SELECT id FROM users WHERE username = 'google-statistics' COLLATE NOCASE), 'Ten highest-rated burger places', 'Google''s numbers, not mine: the ten it rates highest of the 46 burger places in its Tallinn export carrying fifty reviews or more, each rating weighted by how many people left one.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT(id) DO UPDATE SET
    owner = excluded.owner,
    title = excluded.title,
    intro = excluded.intro,
    public = excluded.public,
    updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000;

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('ten-highest-rated-burger-places-tbjbjk', 'ChIJpUvTfUaTkkYRTkZzGPsT1Q0', 'Grill ja Pruul Vanalinn', '', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-burger-places-tbjbjk', 'ChIJuaUoR5vtkkYRHWQqo5yP_rE', 'Hungry Papa', '', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-burger-places-tbjbjk', 'ChIJFeM8AmfzkkYR0ESVTqRgdKA', 'Kaks Kokapoissi', '', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-burger-places-tbjbjk', 'ChIJBa_DUVCUkkYR3kjAlE5aZI4', 'Uulits', '', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-burger-places-tbjbjk', 'burger-box', 'Burger Box', '', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-burger-places-tbjbjk', 'ChIJ59ZCT1eTkkYR-7TqNw8zT4A', 'Vesivärava Grill', '', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-burger-places-tbjbjk', 'ChIJb7aILRCVkkYRAJxgYUovxTA', 'Bunz Smash Burgers', '', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-burger-places-tbjbjk', 'ChIJl7aCSgWVkkYRIUnf5fgbtLI', 'The food corner - tänavatoit | Stroomi', '', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-burger-places-tbjbjk', 'ChIJSR3GF9uVkkYRFIZ4Y5BXaH8', 'Turg resto Nõmme', '', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-burger-places-tbjbjk', 'ChIJM-kDR2iTkkYRxRGbEcEkhsc', 'Estonian Burger Factory', '', 9, CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT(list_id, place_id) DO UPDATE SET
    name = excluded.name,
    pos = excluded.pos;

DELETE FROM list_items WHERE list_id = 'ten-highest-rated-burger-places-tbjbjk' AND place_id NOT IN (
  'ChIJpUvTfUaTkkYRTkZzGPsT1Q0',
  'ChIJuaUoR5vtkkYRHWQqo5yP_rE',
  'ChIJFeM8AmfzkkYR0ESVTqRgdKA',
  'ChIJBa_DUVCUkkYR3kjAlE5aZI4',
  'burger-box',
  'ChIJ59ZCT1eTkkYR-7TqNw8zT4A',
  'ChIJb7aILRCVkkYRAJxgYUovxTA',
  'ChIJl7aCSgWVkkYRIUnf5fgbtLI',
  'ChIJSR3GF9uVkkYRFIZ4Y5BXaH8',
  'ChIJM-kDR2iTkkYRxRGbEcEkhsc'
);

INSERT INTO lists (id, owner, title, intro, public, created_at, updated_at)
VALUES ('ten-highest-rated-kebab-shops-ytt6qf', (SELECT id FROM users WHERE username = 'google-statistics' COLLATE NOCASE), 'Ten highest-rated kebab shops', 'Google''s numbers, not mine: the ten it rates highest of the 35 kebab and shawarma shops in its Tallinn export carrying fifty reviews or more, each rating weighted by how many people left one.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT(id) DO UPDATE SET
    owner = excluded.owner,
    title = excluded.title,
    intro = excluded.intro,
    public = excluded.public,
    updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000;

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('ten-highest-rated-kebab-shops-ytt6qf', 'ChIJ79iYK4iTkkYRzx9l_5WUUUg', 'KebabRA', '', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-kebab-shops-ytt6qf', 'ChIJW74Q0COVkkYRiCmiTlJSo5s', 'Shaurma Kebab Õismäe', '', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-kebab-shops-ytt6qf', 'shaurma-kebab-linnamae', 'Shaurma Kebab Linnamäe', '', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-kebab-shops-ytt6qf', 'ChIJ6TVYVt6TkkYRKLKTWoHyX0A', 'KÜÜSLAUK - Wok & Kebab', '', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-kebab-shops-ytt6qf', 'ChIJ84z_6rrskkYRKnscj7bpBf0', 'Shaurma Kebab Punane', '', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-kebab-shops-ytt6qf', 'ChIJC8wlsBqVkkYRdyN9eIQ1HRo', 'Nõmme Kebab', '', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-kebab-shops-ytt6qf', 'ChIJuS8aixfrkkYRQXybOgkZQ7k', 'Güllüzadem Kebab & Pizza & Baklava', '', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-kebab-shops-ytt6qf', 'ChIJ34RCRBqTkkYRDvNkVD9CwxM', 'Ala Turca Kebab', '', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-kebab-shops-ytt6qf', 'ChIJezZPNwCVkkYRzVB7ngiD-lk', 'Süüria Kebab', '', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-kebab-shops-ytt6qf', 'ChIJiy5M7fqVkkYRP5oHUV4UzUs', 'Brööder Kebab', '', 9, CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT(list_id, place_id) DO UPDATE SET
    name = excluded.name,
    pos = excluded.pos;

DELETE FROM list_items WHERE list_id = 'ten-highest-rated-kebab-shops-ytt6qf' AND place_id NOT IN (
  'ChIJ79iYK4iTkkYRzx9l_5WUUUg',
  'ChIJW74Q0COVkkYRiCmiTlJSo5s',
  'shaurma-kebab-linnamae',
  'ChIJ6TVYVt6TkkYRKLKTWoHyX0A',
  'ChIJ84z_6rrskkYRKnscj7bpBf0',
  'ChIJC8wlsBqVkkYRdyN9eIQ1HRo',
  'ChIJuS8aixfrkkYRQXybOgkZQ7k',
  'ChIJ34RCRBqTkkYRDvNkVD9CwxM',
  'ChIJezZPNwCVkkYRzVB7ngiD-lk',
  'ChIJiy5M7fqVkkYRP5oHUV4UzUs'
);

INSERT INTO lists (id, owner, title, intro, public, created_at, updated_at)
VALUES ('ten-highest-rated-coffee-places-x3tkvk', (SELECT id FROM users WHERE username = 'google-statistics' COLLATE NOCASE), 'Ten highest-rated coffee places', 'Google''s numbers, not mine: the ten it rates highest of the 129 coffee places in its Tallinn export carrying fifty reviews or more, each rating weighted by how many people left one.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT(id) DO UPDATE SET
    owner = excluded.owner,
    title = excluded.title,
    intro = excluded.intro,
    public = excluded.public,
    updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000;

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('ten-highest-rated-coffee-places-x3tkvk', 'ChIJhVJXTR2VkkYR2Xxwqpfnyto', 'Kiosk NO 1', '', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-coffee-places-x3tkvk', 'ChIJQ6QSwpuVkkYRWh30eI392YU', 'Precious café', '', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-coffee-places-x3tkvk', 'morii-tea-house', 'Morii Tea House', '', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-coffee-places-x3tkvk', 'bekker-pagariari', 'Bekker Pagariäri', '', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-coffee-places-x3tkvk', 'ChIJS79JMCeTkkYRPRk5k4Hg1VI', 'Salt''sUp soolakohvik', '', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-coffee-places-x3tkvk', 'kringel', 'Kringel', '', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-coffee-places-x3tkvk', 'ChIJI64XVgCVkkYRYCJ2nZiTQt4', 'Akadeemia Kohv', '', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-coffee-places-x3tkvk', 'ChIJbb3JLmOTkkYRElHmd9Wj104', 'KIOSK NO3', '', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-coffee-places-x3tkvk', 'paper-mill-coffee', 'Paper Mill Coffee', '', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-coffee-places-x3tkvk', 'ChIJ2ZuwYyqVkkYRsmQCB7U5LkI', 'My Little France kohvik', '', 9, CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT(list_id, place_id) DO UPDATE SET
    name = excluded.name,
    pos = excluded.pos;

DELETE FROM list_items WHERE list_id = 'ten-highest-rated-coffee-places-x3tkvk' AND place_id NOT IN (
  'ChIJhVJXTR2VkkYR2Xxwqpfnyto',
  'ChIJQ6QSwpuVkkYRWh30eI392YU',
  'morii-tea-house',
  'bekker-pagariari',
  'ChIJS79JMCeTkkYRPRk5k4Hg1VI',
  'kringel',
  'ChIJI64XVgCVkkYRYCJ2nZiTQt4',
  'ChIJbb3JLmOTkkYRElHmd9Wj104',
  'paper-mill-coffee',
  'ChIJ2ZuwYyqVkkYRsmQCB7U5LkI'
);

INSERT INTO lists (id, owner, title, intro, public, created_at, updated_at)
VALUES ('ten-highest-rated-wine-bars-qfcpcf', (SELECT id FROM users WHERE username = 'google-statistics' COLLATE NOCASE), 'Ten highest-rated wine bars', 'Google''s numbers, not mine: the ten it rates highest of the 11 wine bars in its Tallinn export carrying fifty reviews or more, each rating weighted by how many people left one.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT(id) DO UPDATE SET
    owner = excluded.owner,
    title = excluded.title,
    intro = excluded.intro,
    public = excluded.public,
    updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000;

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('ten-highest-rated-wine-bars-qfcpcf', 'ChIJRZlX09WTkkYR4jNT2TBAqx4', 'Toro veinikohvik', '', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-wine-bars-qfcpcf', 'ChIJBTEaMMeTkkYRWwjQ52jxb8A', 'Veino', '', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-wine-bars-qfcpcf', 'ChIJmYxkmmOTkkYRzcADyRttgns', 'Vixen Vinoteek', '', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-wine-bars-qfcpcf', 'ChIJcZzHCzeVkkYRb53FeamJ6qc', 'Austerium oyster bar & wine', '', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-wine-bars-qfcpcf', 'vabrik', 'Vabrik', '', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-wine-bars-qfcpcf', 'ChIJRwE85XyTkkYRlmAMRVgLUiI', 'Time to Wine Bar and Shop', '', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-wine-bars-qfcpcf', 'ChIJ3y6vtWCTkkYRq8Vqz664Jdg', 'Flamm', '', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-wine-bars-qfcpcf', 'ChIJfbGUU1qTkkYRonQduKZuL34', 'Plan B Wine bar', '', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-wine-bars-qfcpcf', 'ChIJhaWeOXCTkkYRgaEJZ1-IGWQ', 'Chin Chin veinibaar, lounge', '', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ten-highest-rated-wine-bars-qfcpcf', 'ChIJJeOm4_mVkkYRHgX5dn-wtH4', 'OTTO''s Veinibaar', '', 9, CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT(list_id, place_id) DO UPDATE SET
    name = excluded.name,
    pos = excluded.pos;

DELETE FROM list_items WHERE list_id = 'ten-highest-rated-wine-bars-qfcpcf' AND place_id NOT IN (
  'ChIJRZlX09WTkkYR4jNT2TBAqx4',
  'ChIJBTEaMMeTkkYRWwjQ52jxb8A',
  'ChIJmYxkmmOTkkYRzcADyRttgns',
  'ChIJcZzHCzeVkkYRb53FeamJ6qc',
  'vabrik',
  'ChIJRwE85XyTkkYRlmAMRVgLUiI',
  'ChIJ3y6vtWCTkkYRq8Vqz664Jdg',
  'ChIJfbGUU1qTkkYRonQduKZuL34',
  'ChIJhaWeOXCTkkYRgaEJZ1-IGWQ',
  'ChIJJeOm4_mVkkYRHgX5dn-wtH4'
);
