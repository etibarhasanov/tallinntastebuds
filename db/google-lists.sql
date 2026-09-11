INSERT INTO users (id, username, pw_hash, pw_salt, pw_iter, created_at, last_seen_at, about)
VALUES ('google-statistics', 'google-statistics', '0000000000000000000000000000000000000000000000000000000000000000', '6f6f676c65206c69737473206e6f2070', 10000, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000, 'Five top tens out of Google’s own ratings for Tallinn, weighed by how many people gave them. Rebuilt whenever the export refreshes. Google’s numbers, not this map’s verdict.')
ON CONFLICT(id) DO UPDATE SET
    username = excluded.username,
    about = excluded.about;

INSERT INTO lists (id, owner, title, intro, public, created_at, updated_at)
VALUES
  ('top-ten-restaurants-by-google-pt7mwk', 'google-statistics', 'Top ten restaurants, by Google', 'Google’s rating, weighed by how many people gave it: 4.5 from five thousand reviews outranks 4.7 from sixty, and under a hundred reviews is not counted. Google’s numbers, not this map’s verdict.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bakeries-by-google-65nfrf', 'google-statistics', 'Top ten bakeries, by Google', 'Google’s rating, weighed by how many people gave it: 4.5 from five thousand reviews outranks 4.7 from sixty, and under a hundred reviews is not counted. Google’s numbers, not this map’s verdict.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-cafes-by-google-jz7c2b', 'google-statistics', 'Top ten cafés, by Google', 'Google’s rating, weighed by how many people gave it: 4.5 from five thousand reviews outranks 4.7 from sixty, and under a hundred reviews is not counted. Google’s numbers, not this map’s verdict.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bars-by-google-8y6grz', 'google-statistics', 'Top ten bars, by Google', 'Google’s rating, weighed by how many people gave it: 4.5 from five thousand reviews outranks 4.7 from sixty, and under a hundred reviews is not counted. Google’s numbers, not this map’s verdict.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-pizzerias-by-google-k83p93', 'google-statistics', 'Top ten pizzerias, by Google', 'Google’s rating, weighed by how many people gave it: 4.5 from five thousand reviews outranks 4.7 from sixty, and under a hundred reviews is not counted. Google’s numbers, not this map’s verdict.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT(id) DO UPDATE SET
    owner = excluded.owner,
    title = excluded.title,
    intro = excluded.intro,
    updated_at = excluded.updated_at;

DELETE FROM list_items WHERE list_id IN (
  'top-ten-restaurants-by-google-pt7mwk',
  'top-ten-bakeries-by-google-65nfrf',
  'top-ten-cafes-by-google-jz7c2b',
  'top-ten-bars-by-google-8y6grz',
  'top-ten-pizzerias-by-google-k83p93'
);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('top-ten-restaurants-by-google-pt7mwk', 'ChIJAcfoe2KTkkYR1m02V1YbrAo', 'Restaurant Rataskaevu 16', 'Restaurant · 4.8 from 6,587 reviews on Google', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-restaurants-by-google-pt7mwk', 'ChIJofpVY2KTkkYRGqX6iRi16jE', 'Vegan Restoran V', 'Vegan Restaurant · 4.8 from 3,245 reviews on Google', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-restaurants-by-google-pt7mwk', 'ChIJQerzCduTkkYRJwI7m8ZsDQU', 'Saffron Restoran', 'Asian Restaurant · 4.9 from 733 reviews on Google', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-restaurants-by-google-pt7mwk', 'ChIJIXcwdmKTkkYR-HGY5aqV4Ew', 'Väike-rataskaevu​', 'Restaurant · 4.8 from 1,546 reviews on Google', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-restaurants-by-google-pt7mwk', 'ChIJ0dFwitiUkkYRQ3JPMkZYyCg', 'Restoran Mimosa', 'Restaurant · 4.8 from 1,426 reviews on Google', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-restaurants-by-google-pt7mwk', 'ChIJfcbci8STkkYRpzL7c-BKCPA', 'The Kurze', 'Restaurant · 4.8 from 1,221 reviews on Google', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-restaurants-by-google-pt7mwk', 'ChIJAYRP8LuTkkYR4xMB2r8R1f8', 'Ramen Taro Laulupeo', 'Ramen Restaurant · 4.9 from 530 reviews on Google', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-restaurants-by-google-pt7mwk', 'ChIJ5_Tggu6VkkYRrWpu0VHypSQ', 'Pizzeria Santa Lucia', 'Pizza Restaurant · 4.9 from 455 reviews on Google', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-restaurants-by-google-pt7mwk', 'ChIJa-HQBOOVkkYRJCJqORbpFaU', 'Osteria Moderna Itaalia Restoran', 'Restaurant · 4.9 from 415 reviews on Google', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-restaurants-by-google-pt7mwk', 'ChIJ4f4nB56UkkYRY4ShFk6YZHw', 'Mix', 'Restaurant · 4.8 from 742 reviews on Google', 9, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('top-ten-bakeries-by-google-65nfrf', 'ChIJWW3O-o-TkkYRBHFb2Ufl3S8', 'PullaBakery', 'Bakery · 4.9 from 1,656 reviews on Google', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bakeries-by-google-65nfrf', 'ChIJsxeIB7OVkkYRSshyGvfj00U', 'Crustum Bakery', 'Bakery · 4.9 from 477 reviews on Google', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bakeries-by-google-65nfrf', 'ChIJP73vtWCTkkYRAAmn7hNt9aM', 'RØST Bakery', 'Bakery · 4.8 from 3,040 reviews on Google', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bakeries-by-google-65nfrf', 'ChIJUZeGR-OVkkYRZG3R8p3B0Dk', 'BRUTO BAKEHOUSE', 'Bakery · 4.9 from 124 reviews on Google', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bakeries-by-google-65nfrf', 'ChIJvWIuoiWTkkYRcWotAowQqLI', 'Buxhöwden pagar', 'Bakery · 4.8 from 309 reviews on Google', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bakeries-by-google-65nfrf', 'ChIJDxCIqs6VkkYRplHv58D_GIE', 'Mathilda on the Hill', 'Bakery · 4.8 from 165 reviews on Google', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bakeries-by-google-65nfrf', 'ChIJK2sN67STkkYRwHN4UDCWjaQ', 'Magussoolane', 'Bakery · 4.8 from 129 reviews on Google', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bakeries-by-google-65nfrf', 'ChIJ_Wjlj5iUkkYRJ9PNHRiaUsU', 'Pagari Liisu', 'Bakery · 4.7 from 127 reviews on Google', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bakeries-by-google-65nfrf', 'ChIJj1TYVnqTkkYRqp9mU8r8gog', 'Kalamaja Bakery', 'Bakery · 4.7 from 1,015 reviews on Google', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bakeries-by-google-65nfrf', 'ChIJreR0XQaTkkYRbx61GFJoUdo', 'La Boulangerie', 'Bakery · 4.7 from 1,419 reviews on Google', 9, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('top-ten-cafes-by-google-jz7c2b', 'ChIJP73vtWCTkkYRAAmn7hNt9aM', 'RØST Bakery', 'Bakery · 4.8 from 3,040 reviews on Google', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-cafes-by-google-jz7c2b', 'ChIJhVJXTR2VkkYR2Xxwqpfnyto', 'Kiosk NO 1', 'Cafe · 4.9 from 384 reviews on Google', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-cafes-by-google-jz7c2b', 'ChIJG9TEnYaTkkYRLDYTan7s1FU', 'Bekker Pagariäri', 'Cafe · 4.8 from 714 reviews on Google', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-cafes-by-google-jz7c2b', 'ChIJQ6QSwpuVkkYRWh30eI392YU', 'Precious café', 'Coffee Shop · 4.9 from 293 reviews on Google', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-cafes-by-google-jz7c2b', 'ChIJ5SJF0niVkkYRjkBykLAAVwQ', 'Kringel', 'Coffee Shop · 4.8 from 567 reviews on Google', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-cafes-by-google-jz7c2b', 'ChIJe8-Kv9KVkkYRTzFbwfJwU5g', 'Paper Mill Coffee', 'Coffee roastery · 4.8 from 465 reviews on Google', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-cafes-by-google-jz7c2b', 'ChIJnYxLw5WTkkYRbBZIQ-rVs70', 'Morii Tea House', 'Cafe · 5.0 from 165 reviews on Google', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-cafes-by-google-jz7c2b', 'ChIJpTuWpV-TkkYRQvjAHc6YfFw', 'Nikolay Bar-buffeé', 'Cafe · 4.7 from 1,968 reviews on Google', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-cafes-by-google-jz7c2b', 'ChIJS79JMCeTkkYRPRk5k4Hg1VI', 'Salt''sUp soolakohvik', 'Cafe · 4.9 from 235 reviews on Google', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-cafes-by-google-jz7c2b', 'ChIJ88Bs632TkkYRr6xgYOeC0x4', 'The Brick Coffee Roastery', 'Coffee roastery · 4.8 from 388 reviews on Google', 9, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('top-ten-bars-by-google-8y6grz', 'ChIJRZlX09WTkkYR4jNT2TBAqx4', 'Toro veinikohvik', 'Bar · 4.9 from 435 reviews on Google', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bars-by-google-8y6grz', 'ChIJwRoMF56UkkYRMzy7XcbCCS8', 'Whisper Sister', 'Cocktail Bar · 4.8 from 993 reviews on Google', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bars-by-google-8y6grz', 'ChIJsROid2OTkkYRYoRVSMnM_aI', 'Botaanik', 'Bar · 4.9 from 283 reviews on Google', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bars-by-google-8y6grz', 'ChIJ-2SoW2KTkkYRwfWb2eatzsw', 'Koht', 'Bar · 4.7 from 1,466 reviews on Google', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bars-by-google-8y6grz', 'ChIJmYxkmmOTkkYRzcADyRttgns', 'Vixen Vinoteek', 'Wine Bar · 4.8 from 327 reviews on Google', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bars-by-google-8y6grz', 'ChIJDe9LgAGTkkYRJvxK4LX4iRs', 'Barbar', 'Bar · 4.7 from 625 reviews on Google', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bars-by-google-8y6grz', 'ChIJ0-pZBIWTkkYRbcXShJ2vmhk', 'Mnemonic Bar', 'Cocktail Bar · 4.9 from 112 reviews on Google', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bars-by-google-8y6grz', 'ChIJA2cnhT-TkkYR8aJe6ZdKlpg', 'Möku', 'Bar · 4.7 from 275 reviews on Google', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bars-by-google-8y6grz', 'ChIJf4fEsTiTkkYR8lA13Hzs6ko', 'Gambetta', 'Cocktail Bar · 4.9 from 103 reviews on Google', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-bars-by-google-8y6grz', 'ChIJZ-NAJheTkkYRseHi3gBa9f8', 'Piana Vyshnia', 'Bar · 4.7 from 242 reviews on Google', 9, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('top-ten-pizzerias-by-google-k83p93', 'ChIJ5_Tggu6VkkYRrWpu0VHypSQ', 'Pizzeria Santa Lucia', 'Pizza Restaurant · 4.9 from 455 reviews on Google', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-pizzerias-by-google-k83p93', 'ChIJvU1yboCUkkYRQEQ3zQWYemo', 'Kaja Pizza Köök', 'Pizza Restaurant · 4.7 from 2,477 reviews on Google', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-pizzerias-by-google-k83p93', 'ChIJRWkl2XyTkkYR3TQPjLeF8o8', 'Pizzer', 'Pizza Restaurant · 4.8 from 404 reviews on Google', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-pizzerias-by-google-k83p93', 'ChIJbXAHLgCTkkYRZZakJTd6xnw', 'Como restoran & pizzeria', 'Italian Restaurant · 4.8 from 307 reviews on Google', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-pizzerias-by-google-k83p93', 'ChIJYfJlq1uVkkYRNB7XNH0Wv0E', 'La Prima Vanalinn', 'Restaurant · 4.6 from 1,739 reviews on Google', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-pizzerias-by-google-k83p93', 'ChIJKbkn7kPtkkYRi6ep7mankSA', 'Dodo Pizza', 'Pizza Restaurant · 4.6 from 945 reviews on Google', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-pizzerias-by-google-k83p93', 'ChIJyU1EEPeVkkYRkxVx9Cgf4_0', 'Mimosa Brooklyn Pizza Tallinn', 'Restaurant · 4.6 from 448 reviews on Google', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-pizzerias-by-google-k83p93', 'ChIJoXFqI5WVkkYRlLeg1BIG2jQ', 'Monster Pizza', 'Pizza Restaurant · 4.6 from 399 reviews on Google', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-pizzerias-by-google-k83p93', 'ChIJu183TwWVkkYRIH0mH-LmZ3k', 'Pappa Pizza Nõmme', 'Pizza Restaurant · 4.6 from 312 reviews on Google', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('top-ten-pizzerias-by-google-k83p93', 'ChIJjwnVJ2KTkkYRJ4cHGMj90Mg', 'Restoran Controvento', 'Italian Restaurant · 4.5 from 2,600 reviews on Google', 9, CAST(strftime('%s','now') AS INTEGER) * 1000);
