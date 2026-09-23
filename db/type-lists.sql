INSERT OR IGNORE INTO users (id, username, pw_hash, pw_salt, pw_iter, created_at, last_seen_at, about)
VALUES ('tallinntastebuds', 'tallinntastebuds', '0000000000000000000000000000000000000000000000000000000000000000', '7468652063686970732c2061732061', 10000, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000, '');

INSERT INTO lists (id, owner, title, intro, public, created_at, updated_at)
VALUES
  ('all-the-casual-and-solo-places-5xjdth', (SELECT id FROM users WHERE username = 'tallinntastebuds'), 'All the casual and solo places in Tallinn', 'Every place on the map of Tallinn that carries the Casual/Solo chip — visited and approved, in the alphabet. Rebuilt whenever the map is, and anywhere that has closed since is left off.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', (SELECT id FROM users WHERE username = 'tallinntastebuds'), 'All the bakeries in Tallinn', 'Every place on the map of Tallinn that carries the Bakery chip — visited and approved, in the alphabet. Rebuilt whenever the map is, and anywhere that has closed since is left off.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', (SELECT id FROM users WHERE username = 'tallinntastebuds'), 'All the coffee and tea places in Tallinn', 'Every place on the map of Tallinn that carries the Coffee/tea chip — visited and approved, in the alphabet. Rebuilt whenever the map is, and anywhere that has closed since is left off.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-pubs-and-beer-bars-3q29c9', (SELECT id FROM users WHERE username = 'tallinntastebuds'), 'All the pubs and beer bars in Tallinn', 'Every place on the map of Tallinn that carries the Beer/pub chip — visited and approved, in the alphabet. Rebuilt whenever the map is, and anywhere that has closed since is left off.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', (SELECT id FROM users WHERE username = 'tallinntastebuds'), 'All the hidden gems in Tallinn', 'Every place on the map of Tallinn that carries the Hidden gem chip — visited and approved, in the alphabet. Rebuilt whenever the map is, and anywhere that has closed since is left off.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-cheap-eats-t7yn32', (SELECT id FROM users WHERE username = 'tallinntastebuds'), 'All the cheap eats in Tallinn', 'Every place on the map of Tallinn that carries the Cheap eats chip — visited and approved, in the alphabet. Rebuilt whenever the map is, and anywhere that has closed since is left off.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-laptop-friendly-places-qbf3nf', (SELECT id FROM users WHERE username = 'tallinntastebuds'), 'All the laptop friendly places in Tallinn', 'Every place on the map of Tallinn that carries the Laptop friendly chip — visited and approved, in the alphabet. Rebuilt whenever the map is, and anywhere that has closed since is left off.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-date-night-places-3n445f', (SELECT id FROM users WHERE username = 'tallinntastebuds'), 'All the date night places in Tallinn', 'Every place on the map of Tallinn that carries the Date night chip — visited and approved, in the alphabet. Rebuilt whenever the map is, and anywhere that has closed since is left off.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-asian-places-jzhqqq', (SELECT id FROM users WHERE username = 'tallinntastebuds'), 'All the Asian places in Tallinn', 'Every place on the map of Tallinn that carries the Asian chip — visited and approved, in the alphabet. Rebuilt whenever the map is, and anywhere that has closed since is left off.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-vegan-places-svmsrw', (SELECT id FROM users WHERE username = 'tallinntastebuds'), 'All the vegan places in Tallinn', 'Every place on the map of Tallinn that carries the Vegan chip — visited and approved, in the alphabet. Rebuilt whenever the map is, and anywhere that has closed since is left off.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-fine-dining-places-nvrz5g', (SELECT id FROM users WHERE username = 'tallinntastebuds'), 'All the fine dining places in Tallinn', 'Every place on the map of Tallinn that carries the Fine dining chip — visited and approved, in the alphabet. Rebuilt whenever the map is, and anywhere that has closed since is left off.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-caucasus-places-r8xn4m', (SELECT id FROM users WHERE username = 'tallinntastebuds'), 'All the Caucasus places in Tallinn', 'Every place on the map of Tallinn that carries the Caucasus chip — visited and approved, in the alphabet. Rebuilt whenever the map is, and anywhere that has closed since is left off.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', (SELECT id FROM users WHERE username = 'tallinntastebuds'), 'All the restaurants in Tallinn', 'Every place on the map of Tallinn that carries the Restaurant chip — visited and approved, in the alphabet. Rebuilt whenever the map is, and anywhere that has closed since is left off.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000)
ON CONFLICT(id) DO UPDATE SET
    owner = excluded.owner,
    title = excluded.title,
    intro = excluded.intro,
    public = excluded.public,
    updated_at = excluded.updated_at;

DELETE FROM list_items WHERE list_id IN (
  'all-the-casual-and-solo-places-5xjdth',
  'all-the-bakeries-vncgvm',
  'all-the-coffee-and-tea-places-gq9nms',
  'all-the-pubs-and-beer-bars-3q29c9',
  'all-the-hidden-gems-htp2gd',
  'all-the-cheap-eats-t7yn32',
  'all-the-laptop-friendly-places-qbf3nf',
  'all-the-date-night-places-3n445f',
  'all-the-asian-places-jzhqqq',
  'all-the-vegan-places-svmsrw',
  'all-the-fine-dining-places-nvrz5g',
  'all-the-caucasus-places-r8xn4m',
  'all-the-restaurants-rxz3tt'
);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('all-the-casual-and-solo-places-5xjdth', 'ariran', 'Ariran', 'We pass by daily and somehow kept skipping it.', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'baklazaan', 'Baklažaan', 'Out on the way to the Nõmme bike route, which is a fine ride in itself.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'balta-chill', 'Balta Chill', 'A hidden yard off Vana-Kalamaja that somebody has to tell you about.', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'borsch-ja-varenyk', 'Borsch & Varenyk', 'A cozy place next to Taksopark for warm borscht, vareniki and other homemade Ukrainian dishes.', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'bruto-bakehouse', 'Bruto Bakehouse', 'A bakehouse in the Old Town that lives for cookies.', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'burger-box', 'Burger Box', 'Once just a small burger window next to the old Põhjala Speakeasy, it has kept its street-food soul while the menu got bolder.', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'cafe-tempo', 'Cafe Tempo', 'The place is in a cool spot, and it gets lots of sun.', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'chocolala', 'Chocolala', 'Award-winning chocolates made right here, with a small chocolate museum on Suur-Karja.', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'dvin', 'DVIN', 'Georgian food, honest and delicious, out in Kopli.', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'elman-bites', 'Elmans Bites', 'A kiosk in Telliskivi with really nice falafel.', 9, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'f-hoone', 'F-Hoone', 'Breakfast, lunch, pizza and sandwiches, all day in one of the oldest buildings in Telliskivi.', 10, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'faehlmanni-kohvik', 'Faehlmanni kohvik', 'A corner cafe that has been on Faehlmanni a long time, and it is one of the nicest corners in the neighbourhood.', 11, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'fotografiska-cafe', 'Fotografiska Café & Bakery', 'The ground floor of the Fotografiska building: a shop at the door, the museum one way, the restaurant upstairs, and this bakery filling the middle.', 12, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'gotsu-kyuho', 'Gotsu Kyuho''s Kitchen', 'A Korean restaurant that''s been here a long time, known for its flavours, peppery spices and warm atmosphere.', 13, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'hans', 'HAN''s Restoran', 'Hans means my humble home.', 14, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'hell-hunt', 'Hell Hunt', 'Very good beers from Humalakoda, and the kitchen holds up too.', 15, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'izakaya-taro', 'Izakaya Taro', 'Japanese small plates on Müürivahe, in the Old Town.', 16, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'kalve-kadriorg', 'Kalve Kadriorg', 'Specialty coffee on the Kadriorg corner of Faehlmanni, roasted by Kalve.', 17, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'kartul', 'Kartul', 'Fully vegan and built entirely around the potato, right by the tram stop in Telliskivi.', 18, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'karu-talu-sokolaad', 'Karu Talu Šokolaad', 'A family-size cookie in the Old Town.', 19, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'klorofull', 'Klorofüll', 'A hidden gem on the second floor of the ARS art factory.', 20, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'koht', 'Koht', 'A small beer bar hidden on Lai 8 with more than 800 kinds of beer from all over the world.', 21, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'kokomo', 'Kokomo Coffee Roasters', 'Another definition for hyggelig.', 22, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'kotkot', 'KotKot', 'Really nice chicken at Noblessner, and the chicken burger is the one to order.', 23, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'la-boulangerie', 'La Boulangerie', 'Even if I don’t like interior for some unknown reason, their pastries are delicious.', 24, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'magussoolane', 'Magussoolane', 'A bakery in Kadriorg where the sweet and the savoury are equally good.', 25, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'mikkeller-old-town', 'Mikkeller Tallinn Old Town', 'Mikkeller is one of the biggest names in craft beer, and this one pairs it with real food.', 26, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'morii-tea-house', 'Morii Tea House', 'New in Telliskivi and already second place for tea at the Helsinki tea and coffee festival.', 27, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'nullijook', 'Nullijook', 'An alcohol free bottle shop with a serious list.', 28, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'paper-mill-coffee', 'Paper Mill Coffee', 'Built in 1912 as the fire station for a massive Tallinn paper mill.', 29, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'paper-mill-coffee-volta', 'Paper Mill Coffee Volta', 'The second Paper Mill, out in the Volta quarter.', 30, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'pohja-konn', 'Põhja Konn', 'Põhjala''s own bar in Telliskivi, pouring their beers next to plenty of other craft.', 31, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'pudel', 'Pudel', 'A good place to bring a group and settle in for the evening.', 32, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'puhaste-taproom', 'Pühaste Taproom', 'A Tartu craft brewery with a taproom on a busy Rotermann street.', 33, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'pulla-bakery', 'Pulla Bakery', 'Handmade sourdough buns baked by a mother and daughter in the heart of the Old Town.', 34, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'q-pizza-jaam', 'Q Pizza Jaam', 'Pizza and sandwiches, and they bake the bread themselves.', 35, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'ramen-taro', 'Ramen Taro', 'My go-to meal has always been soup, and ramen taro has been the neighbourhood spot.', 36, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'saffron', 'Saffron', 'An Indian kitchen on Gonsiori.', 37, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'shaurma-kebab-linnamae', 'Shaurma Kebab Linnamäe', 'A Turkish kebab counter out in Linnamäe.', 38, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'telliskivi-saslokk', 'Telliskivi Šašlõkk', 'Turkish cooking on the Telliskivi corner, and they bake their own bread.', 39, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'the-brick-coffee', 'The Brick Coffee Roastery', 'A coffee roastery with genuinely good food and a great feel to the room.', 40, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'vabrik', 'Vabrik', 'The cheapest wine in town, house pours and a proper list beside them, and it is a bottle shop too, so you can leave with one.', 41, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'varav-coffee-toast', 'Värav Coffee and toast', 'A little white house with a red roof at the end of a car park, right under the Old Town bastion, with the greenery on the sunny side.', 42, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'varkizana', 'Varkizana Kreeka tavern', 'A Greek tavern in Lasnamäe, and everything we tried was really good.', 43, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-casual-and-solo-places-5xjdth', 'xinhai-1911', 'Xinhai 1911 Restoran & Baar', 'Chinese cooking by Balti jaam, and the hand-pulled biang biang noodles are the reason to come.', 44, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('all-the-bakeries-vncgvm', 'bekker-pagariari', 'Bekker Pagariäri', 'The OG bakery, supplying bread and kringels to lots of places in town.', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'bruto-bakehouse', 'Bruto Bakehouse', 'A bakehouse in the Old Town that lives for cookies.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'buxhowden-pagar', 'Buxhöwden pagar', 'A really cool bakery out on the way to Viimsi.', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'cafe-tempo', 'Cafe Tempo', 'The place is in a cool spot, and it gets lots of sun.', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'chocolala', 'Chocolala', 'Award-winning chocolates made right here, with a small chocolate museum on Suur-Karja.', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'crustum-bakery', 'Crustum Bakery', 'The first bakery from the team behind La Boulangerie, and it has been feeding Mustamäe for years.', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'faehlmanni-kohvik', 'Faehlmanni kohvik', 'A corner cafe that has been on Faehlmanni a long time, and it is one of the nicest corners in the neighbourhood.', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'fotografiska-cafe', 'Fotografiska Café & Bakery', 'The ground floor of the Fotografiska building: a shop at the door, the museum one way, the restaurant upstairs, and this bakery filling the middle.', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'francois-boulangerie', 'François Boulangerie', 'François and his croissants are back on Härjapea street.', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'karu-talu-sokolaad', 'Karu Talu Šokolaad', 'A family-size cookie in the Old Town.', 9, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'koho', 'KoHo', 'Restaurant, bakery and bar on the Telliskivi corner: floor to ceiling glass, plants everywhere and tables out on the pavement.', 10, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'kringel', 'Kringel', 'A vegan place with very good kringels.', 11, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'la-boulangerie', 'La Boulangerie', 'Even if I don’t like interior for some unknown reason, their pastries are delicious.', 12, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'magussoolane', 'Magussoolane', 'A bakery in Kadriorg where the sweet and the savoury are equally good.', 13, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'paper-mill-coffee-volta', 'Paper Mill Coffee Volta', 'The second Paper Mill, out in the Volta quarter.', 14, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'porgandipomm', 'Porgandipomm', 'A properly hidden bakery in the Manufaktuuri quarter, and the baking is worth the finding.', 15, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-bakeries-vncgvm', 'pulla-bakery', 'Pulla Bakery', 'Handmade sourdough buns baked by a mother and daughter in the heart of the Old Town.', 16, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('all-the-coffee-and-tea-places-gq9nms', 'bekker-pagariari', 'Bekker Pagariäri', 'The OG bakery, supplying bread and kringels to lots of places in town.', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'bruto-bakehouse', 'Bruto Bakehouse', 'A bakehouse in the Old Town that lives for cookies.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'chamber-tea', 'Chamber Tea', 'Masters of tea who know exactly what they are doing.', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'faehlmanni-kohvik', 'Faehlmanni kohvik', 'A corner cafe that has been on Faehlmanni a long time, and it is one of the nicest corners in the neighbourhood.', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'fotografiska-cafe', 'Fotografiska Café & Bakery', 'The ground floor of the Fotografiska building: a shop at the door, the museum one way, the restaurant upstairs, and this bakery filling the middle.', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'kalve-kadriorg', 'Kalve Kadriorg', 'Specialty coffee on the Kadriorg corner of Faehlmanni, roasted by Kalve.', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'kokomo', 'Kokomo Coffee Roasters', 'Another definition for hyggelig.', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'kringel', 'Kringel', 'A vegan place with very good kringels.', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'la-boulangerie', 'La Boulangerie', 'Even if I don’t like interior for some unknown reason, their pastries are delicious.', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'magussoolane', 'Magussoolane', 'A bakery in Kadriorg where the sweet and the savoury are equally good.', 9, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'morii-tea-house', 'Morii Tea House', 'New in Telliskivi and already second place for tea at the Helsinki tea and coffee festival.', 10, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'nullijook', 'Nullijook', 'An alcohol free bottle shop with a serious list.', 11, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'paper-mill-coffee', 'Paper Mill Coffee', 'Built in 1912 as the fire station for a massive Tallinn paper mill.', 12, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'paper-mill-coffee-volta', 'Paper Mill Coffee Volta', 'The second Paper Mill, out in the Volta quarter.', 13, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'pulla-bakery', 'Pulla Bakery', 'Handmade sourdough buns baked by a mother and daughter in the heart of the Old Town.', 14, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'the-brick-coffee', 'The Brick Coffee Roastery', 'A coffee roastery with genuinely good food and a great feel to the room.', 15, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-coffee-and-tea-places-gq9nms', 'varav-coffee-toast', 'Värav Coffee and toast', 'A little white house with a red roof at the end of a car park, right under the Old Town bastion, with the greenery on the sunny side.', 16, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('all-the-pubs-and-beer-bars-3q29c9', 'balta-chill', 'Balta Chill', 'A hidden yard off Vana-Kalamaja that somebody has to tell you about.', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-pubs-and-beer-bars-3q29c9', 'hell-hunt', 'Hell Hunt', 'Very good beers from Humalakoda, and the kitchen holds up too.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-pubs-and-beer-bars-3q29c9', 'koht', 'Koht', 'A small beer bar hidden on Lai 8 with more than 800 kinds of beer from all over the world.', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-pubs-and-beer-bars-3q29c9', 'laboratooriumi-23', 'Laboratooriumi 23', 'Foosball, sandwiches, drinks and a sauna, all in one place.', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-pubs-and-beer-bars-3q29c9', 'mikkeller-old-town', 'Mikkeller Tallinn Old Town', 'Mikkeller is one of the biggest names in craft beer, and this one pairs it with real food.', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-pubs-and-beer-bars-3q29c9', 'pilsneri-baar', 'Pilsneri baar', 'Three different ways of pouring Pilsner Urquell, which is the whole reason to come.', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-pubs-and-beer-bars-3q29c9', 'pohja-konn', 'Põhja Konn', 'Põhjala''s own bar in Telliskivi, pouring their beers next to plenty of other craft.', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-pubs-and-beer-bars-3q29c9', 'pudel', 'Pudel', 'A good place to bring a group and settle in for the evening.', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-pubs-and-beer-bars-3q29c9', 'puhaste-taproom', 'Pühaste Taproom', 'A Tartu craft brewery with a taproom on a busy Rotermann street.', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-pubs-and-beer-bars-3q29c9', 'tuletorn', 'Tuletorn', 'Tuletorn means lighthouse.', 9, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-pubs-and-beer-bars-3q29c9', 'uba-ja-humal', 'Uba ja Humal', 'Cheapest beer in the centre.', 10, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-pubs-and-beer-bars-3q29c9', 'vaat-brewery', 'Vaat Brewery and Taproom', 'A craft brewery and taproom well out of the centre, and properly hidden at the moment.', 11, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-pubs-and-beer-bars-3q29c9', 'vana-villem', 'Vana Villem', 'A cozy local pub with old-school vibes, big portions and cheap beer.', 12, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('all-the-hidden-gems-htp2gd', 'annon', 'Annön', 'I love when they opened the restaurant, their motto was “food should be useful to the body”.', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', 'ariran', 'Ariran', 'We pass by daily and somehow kept skipping it.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', 'balta-chill', 'Balta Chill', 'A hidden yard off Vana-Kalamaja that somebody has to tell you about.', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', 'chamber-tea', 'Chamber Tea', 'Masters of tea who know exactly what they are doing.', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', 'crustum-bakery', 'Crustum Bakery', 'The first bakery from the team behind La Boulangerie, and it has been feeding Mustamäe for years.', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', 'dvin', 'DVIN', 'Georgian food, honest and delicious, out in Kopli.', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', 'francois-boulangerie', 'François Boulangerie', 'François and his croissants are back on Härjapea street.', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', 'gotsu-kyuho', 'Gotsu Kyuho''s Kitchen', 'A Korean restaurant that''s been here a long time, known for its flavours, peppery spices and warm atmosphere.', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', 'klorofull', 'Klorofüll', 'A hidden gem on the second floor of the ARS art factory.', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', 'laboratooriumi-23', 'Laboratooriumi 23', 'Foosball, sandwiches, drinks and a sauna, all in one place.', 9, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', 'porgandipomm', 'Porgandipomm', 'A properly hidden bakery in the Manufaktuuri quarter, and the baking is worth the finding.', 10, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', 'vaat-brewery', 'Vaat Brewery and Taproom', 'A craft brewery and taproom well out of the centre, and properly hidden at the moment.', 11, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', 'varav-coffee-toast', 'Värav Coffee and toast', 'A little white house with a red roof at the end of a car park, right under the Old Town bastion, with the greenery on the sunny side.', 12, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-hidden-gems-htp2gd', 'varkizana', 'Varkizana Kreeka tavern', 'A Greek tavern in Lasnamäe, and everything we tried was really good.', 13, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('all-the-cheap-eats-t7yn32', 'annon', 'Annön', 'I love when they opened the restaurant, their motto was “food should be useful to the body”.', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-cheap-eats-t7yn32', 'borsch-ja-varenyk', 'Borsch & Varenyk', 'A cozy place next to Taksopark for warm borscht, vareniki and other homemade Ukrainian dishes.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-cheap-eats-t7yn32', 'burger-box', 'Burger Box', 'Once just a small burger window next to the old Põhjala Speakeasy, it has kept its street-food soul while the menu got bolder.', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-cheap-eats-t7yn32', 'dvin', 'DVIN', 'Georgian food, honest and delicious, out in Kopli.', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-cheap-eats-t7yn32', 'kartul', 'Kartul', 'Fully vegan and built entirely around the potato, right by the tram stop in Telliskivi.', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-cheap-eats-t7yn32', 'kotkot', 'KotKot', 'Really nice chicken at Noblessner, and the chicken burger is the one to order.', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-cheap-eats-t7yn32', 'mix-resto', 'MIX Resto', 'A fine dining experience in the Old Town at lunch prices.', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-cheap-eats-t7yn32', 'pirosmani', 'Pirosmani', 'Georgian food, big on flavour and generous in size.', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-cheap-eats-t7yn32', 'shaurma-kebab-linnamae', 'Shaurma Kebab Linnamäe', 'A Turkish kebab counter out in Linnamäe.', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-cheap-eats-t7yn32', 'uba-ja-humal', 'Uba ja Humal', 'Cheapest beer in the centre.', 9, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-cheap-eats-t7yn32', 'vana-villem', 'Vana Villem', 'A cozy local pub with old-school vibes, big portions and cheap beer.', 10, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('all-the-laptop-friendly-places-qbf3nf', 'chamber-tea', 'Chamber Tea', 'Masters of tea who know exactly what they are doing.', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-laptop-friendly-places-qbf3nf', 'faehlmanni-kohvik', 'Faehlmanni kohvik', 'A corner cafe that has been on Faehlmanni a long time, and it is one of the nicest corners in the neighbourhood.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-laptop-friendly-places-qbf3nf', 'fotografiska-cafe', 'Fotografiska Café & Bakery', 'The ground floor of the Fotografiska building: a shop at the door, the museum one way, the restaurant upstairs, and this bakery filling the middle.', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-laptop-friendly-places-qbf3nf', 'kalve-kadriorg', 'Kalve Kadriorg', 'Specialty coffee on the Kadriorg corner of Faehlmanni, roasted by Kalve.', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-laptop-friendly-places-qbf3nf', 'morii-tea-house', 'Morii Tea House', 'New in Telliskivi and already second place for tea at the Helsinki tea and coffee festival.', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-laptop-friendly-places-qbf3nf', 'paper-mill-coffee', 'Paper Mill Coffee', 'Built in 1912 as the fire station for a massive Tallinn paper mill.', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-laptop-friendly-places-qbf3nf', 'paper-mill-coffee-volta', 'Paper Mill Coffee Volta', 'The second Paper Mill, out in the Volta quarter.', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-laptop-friendly-places-qbf3nf', 'varav-coffee-toast', 'Värav Coffee and toast', 'A little white house with a red roof at the end of a car park, right under the Old Town bastion, with the greenery on the sunny side.', 7, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('all-the-date-night-places-3n445f', '180-degrees', '180° by Matthias Diether', 'The only two Michelin star restaurant in the Baltics.', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-date-night-places-3n445f', 'cafe-tempo', 'Cafe Tempo', 'The place is in a cool spot, and it gets lots of sun.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-date-night-places-3n445f', 'f-hoone', 'F-Hoone', 'Breakfast, lunch, pizza and sandwiches, all day in one of the oldest buildings in Telliskivi.', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-date-night-places-3n445f', 'fotografiska', 'Fotografiska', 'Fine dining where everything comes from local producers, with their own beehives and their own fermentation.', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-date-night-places-3n445f', 'gobi', 'Gobi', 'Modern Georgian cuisine in Rotermanni.', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-date-night-places-3n445f', 'mix-resto', 'MIX Resto', 'A fine dining experience in the Old Town at lunch prices.', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-date-night-places-3n445f', 'radio-restoran', 'Radio', 'Sharing is caring is the motto here, and it''s the right way to eat.', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-date-night-places-3n445f', 'the-brick-coffee', 'The Brick Coffee Roastery', 'A coffee roastery with genuinely good food and a great feel to the room.', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-date-night-places-3n445f', 'vesta', 'Vesta', 'Vesta has arrived with small project, and now the restaurant is fully booked every day.', 8, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('all-the-asian-places-jzhqqq', 'annon', 'Annön', 'I love when they opened the restaurant, their motto was “food should be useful to the body”.', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-asian-places-jzhqqq', 'ariran', 'Ariran', 'We pass by daily and somehow kept skipping it.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-asian-places-jzhqqq', 'burger-box', 'Burger Box', 'Once just a small burger window next to the old Põhjala Speakeasy, it has kept its street-food soul while the menu got bolder.', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-asian-places-jzhqqq', 'chakra', 'Chakra', 'Most of you have tried this Indian kitchen from Bolt Food, but the Old Town room is special: a very old building, and a chef who moved to Estonia in 1992 and finally opened his own place in 2009.', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-asian-places-jzhqqq', 'gotsu-kyuho', 'Gotsu Kyuho''s Kitchen', 'A Korean restaurant that''s been here a long time, known for its flavours, peppery spices and warm atmosphere.', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-asian-places-jzhqqq', 'hans', 'HAN''s Restoran', 'Hans means my humble home.', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-asian-places-jzhqqq', 'izakaya-taro', 'Izakaya Taro', 'Japanese small plates on Müürivahe, in the Old Town.', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-asian-places-jzhqqq', 'ramen-taro', 'Ramen Taro', 'My go-to meal has always been soup, and ramen taro has been the neighbourhood spot.', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-asian-places-jzhqqq', 'saffron', 'Saffron', 'An Indian kitchen on Gonsiori.', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-asian-places-jzhqqq', 'xinhai-1911', 'Xinhai 1911 Restoran & Baar', 'Chinese cooking by Balti jaam, and the hand-pulled biang biang noodles are the reason to come.', 9, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('all-the-vegan-places-svmsrw', 'burger-box', 'Burger Box', 'Once just a small burger window next to the old Põhjala Speakeasy, it has kept its street-food soul while the menu got bolder.', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-vegan-places-svmsrw', 'chakra', 'Chakra', 'Most of you have tried this Indian kitchen from Bolt Food, but the Old Town room is special: a very old building, and a chef who moved to Estonia in 1992 and finally opened his own place in 2009.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-vegan-places-svmsrw', 'kartul', 'Kartul', 'Fully vegan and built entirely around the potato, right by the tram stop in Telliskivi.', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-vegan-places-svmsrw', 'karu-talu-sokolaad', 'Karu Talu Šokolaad', 'A family-size cookie in the Old Town.', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-vegan-places-svmsrw', 'klorofull', 'Klorofüll', 'A hidden gem on the second floor of the ARS art factory.', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-vegan-places-svmsrw', 'kringel', 'Kringel', 'A vegan place with very good kringels.', 5, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('all-the-fine-dining-places-nvrz5g', '180-degrees', '180° by Matthias Diether', 'The only two Michelin star restaurant in the Baltics.', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-fine-dining-places-nvrz5g', 'fotografiska', 'Fotografiska', 'Fine dining where everything comes from local producers, with their own beehives and their own fermentation.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-fine-dining-places-nvrz5g', 'gobi', 'Gobi', 'Modern Georgian cuisine in Rotermanni.', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-fine-dining-places-nvrz5g', 'mix-resto', 'MIX Resto', 'A fine dining experience in the Old Town at lunch prices.', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-fine-dining-places-nvrz5g', 'vesta', 'Vesta', 'Vesta has arrived with small project, and now the restaurant is fully booked every day.', 4, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('all-the-caucasus-places-r8xn4m', 'badam', 'Badam', 'The most authentic Azerbaijani cooking in Tallinn.', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-caucasus-places-r8xn4m', 'baklazaan', 'Baklažaan', 'Out on the way to the Nõmme bike route, which is a fine ride in itself.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-caucasus-places-r8xn4m', 'dvin', 'DVIN', 'Georgian food, honest and delicious, out in Kopli.', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-caucasus-places-r8xn4m', 'faeton', 'Faeton', 'As azeri I approve this place.', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-caucasus-places-r8xn4m', 'gobi', 'Gobi', 'Modern Georgian cuisine in Rotermanni.', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-caucasus-places-r8xn4m', 'pirosmani', 'Pirosmani', 'Georgian food, big on flavour and generous in size.', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-caucasus-places-r8xn4m', 'telliskivi-saslokk', 'Telliskivi Šašlõkk', 'Turkish cooking on the Telliskivi corner, and they bake their own bread.', 6, CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO list_items (list_id, place_id, name, say, pos, created_at)
VALUES
  ('all-the-restaurants-rxz3tt', '180-degrees', '180° by Matthias Diether', 'The only two Michelin star restaurant in the Baltics.', 0, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'annon', 'Annön', 'I love when they opened the restaurant, their motto was “food should be useful to the body”.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'ariran', 'Ariran', 'We pass by daily and somehow kept skipping it.', 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'badam', 'Badam', 'The most authentic Azerbaijani cooking in Tallinn.', 3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'baklazaan', 'Baklažaan', 'Out on the way to the Nõmme bike route, which is a fine ride in itself.', 4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'borsch-ja-varenyk', 'Borsch & Varenyk', 'A cozy place next to Taksopark for warm borscht, vareniki and other homemade Ukrainian dishes.', 5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'cafe-tempo', 'Cafe Tempo', 'The place is in a cool spot, and it gets lots of sun.', 6, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'chakra', 'Chakra', 'Most of you have tried this Indian kitchen from Bolt Food, but the Old Town room is special: a very old building, and a chef who moved to Estonia in 1992 and finally opened his own place in 2009.', 7, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'dvin', 'DVIN', 'Georgian food, honest and delicious, out in Kopli.', 8, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'f-hoone', 'F-Hoone', 'Breakfast, lunch, pizza and sandwiches, all day in one of the oldest buildings in Telliskivi.', 9, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'faeton', 'Faeton', 'As azeri I approve this place.', 10, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'fotografiska', 'Fotografiska', 'Fine dining where everything comes from local producers, with their own beehives and their own fermentation.', 11, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'gobi', 'Gobi', 'Modern Georgian cuisine in Rotermanni.', 12, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'gotsu-kyuho', 'Gotsu Kyuho''s Kitchen', 'A Korean restaurant that''s been here a long time, known for its flavours, peppery spices and warm atmosphere.', 13, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'hans', 'HAN''s Restoran', 'Hans means my humble home.', 14, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'izakaya-taro', 'Izakaya Taro', 'Japanese small plates on Müürivahe, in the Old Town.', 15, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'kartul', 'Kartul', 'Fully vegan and built entirely around the potato, right by the tram stop in Telliskivi.', 16, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'klorofull', 'Klorofüll', 'A hidden gem on the second floor of the ARS art factory.', 17, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'koho', 'KoHo', 'Restaurant, bakery and bar on the Telliskivi corner: floor to ceiling glass, plants everywhere and tables out on the pavement.', 18, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'mix-resto', 'MIX Resto', 'A fine dining experience in the Old Town at lunch prices.', 19, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'pirosmani', 'Pirosmani', 'Georgian food, big on flavour and generous in size.', 20, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'radio-restoran', 'Radio', 'Sharing is caring is the motto here, and it''s the right way to eat.', 21, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'ramen-taro', 'Ramen Taro', 'My go-to meal has always been soup, and ramen taro has been the neighbourhood spot.', 22, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'saffron', 'Saffron', 'An Indian kitchen on Gonsiori.', 23, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'varkizana', 'Varkizana Kreeka tavern', 'A Greek tavern in Lasnamäe, and everything we tried was really good.', 24, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'vesta', 'Vesta', 'Vesta has arrived with small project, and now the restaurant is fully booked every day.', 25, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('all-the-restaurants-rxz3tt', 'xinhai-1911', 'Xinhai 1911 Restoran & Baar', 'Chinese cooking by Balti jaam, and the hand-pulled biang biang noodles are the reason to come.', 26, CAST(strftime('%s','now') AS INTEGER) * 1000);
