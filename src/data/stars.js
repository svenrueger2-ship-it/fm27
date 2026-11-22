// Hand-tuned ratings for well-known players: name -> [pos, overall, age]
export const STARS = {
  'Harry Kane': ['ST', 90, 33], 'Michael Olise': ['RA', 88, 24], 'Jamal Musiala': ['OM', 89, 23], 'Joshua Kimmich': ['DM', 88, 31], 'Manuel Neuer': ['TW', 85, 40],
  'Dayot Upamecano': ['IV', 85, 28], 'Luis Díaz': ['LA', 86, 29], 'Kim Min-jae': ['IV', 84, 29], 'Alphonso Davies': ['LV', 84, 26], 'Jonathan Tah': ['IV', 85, 30],
  'Serhou Guirassy': ['ST', 85, 30], 'Gregor Kobel': ['TW', 86, 28], 'Nico Schlotterbeck': ['IV', 85, 26], 'Julian Brandt': ['OM', 83, 30], 'Karim Adeyemi': ['LA', 82, 24],
  'Florian Wirtz': ['OM', 89, 23], 'Mohamed Salah': ['RA', 88, 34], 'Virgil van Dijk': ['IV', 88, 35], 'Alexander Isak': ['ST', 88, 27], 'Alisson Becker': ['TW', 87, 34],
  'Alexis Mac Allister': ['ZM', 86, 27], 'Dominik Szoboszlai': ['ZM', 85, 26], 'Ryan Gravenberch': ['DM', 85, 24], 'Hugo Ekitike': ['ST', 84, 24], 'Cody Gakpo': ['LA', 84, 27],
  'Erling Haaland': ['ST', 91, 26], 'Rúben Dias': ['IV', 87, 29], 'Phil Foden': ['OM', 86, 26], 'Gianluigi Donnarumma': ['TW', 88, 27], 'Joško Gvardiol': ['IV', 85, 24],
  'Rayan Cherki': ['OM', 84, 23], 'Jérémy Doku': ['LA', 84, 24], 'Enzo Fernández': ['ZM', 85, 25], 'Antoine Semenyo': ['RA', 83, 26],
  'Bukayo Saka': ['RA', 88, 25], 'Declan Rice': ['ZM', 88, 27], 'William Saliba': ['IV', 88, 25], 'Martin Ødegaard': ['OM', 86, 27], 'Gabriel Magalhães': ['IV', 86, 28],
  'David Raya': ['TW', 86, 31], 'Viktor Gyökeres': ['ST', 85, 28], 'Martín Zubimendi': ['DM', 86, 27], 'Eberechi Eze': ['OM', 84, 28], 'Bruno Guimarães': ['ZM', 85, 28],
  'Cole Palmer': ['OM', 87, 24], 'Moisés Caicedo': ['DM', 87, 24], 'Reece James': ['RV', 84, 26], 'João Pedro': ['ST', 83, 25], 'Estêvão': ['RA', 82, 19], 'Emiliano Martínez': ['TW', 85, 34],
  'Bruno Fernandes': ['OM', 86, 32], 'Bryan Mbeumo': ['RA', 84, 27], 'Matheus Cunha': ['ST', 84, 27], 'Benjamin Šeško': ['ST', 82, 23], 'Kobbie Mainoo': ['ZM', 81, 21],
  'Xavi Simons': ['OM', 84, 23], 'Micky van de Ven': ['IV', 84, 25], 'Pedro Porro': ['RV', 83, 27], 'Sandro Tonali': ['ZM', 85, 26], 'Andrew Robertson': ['LV', 82, 32], 'Mohammed Kudus': ['RA', 83, 26],
  'Ollie Watkins': ['ST', 84, 30], 'Morgan Rogers': ['OM', 83, 24], 'Elliot Anderson': ['ZM', 83, 23], 'Morgan Gibbs-White': ['OM', 83, 26], 'Adam Wharton': ['ZM', 82, 22],
  'Jean-Philippe Mateta': ['ST', 81, 29], 'Kaoru Mitoma': ['LA', 82, 29], 'Marc Guéhi': ['IV', 85, 26], 'Bernd Leno': ['TW', 81, 34], 'Yoane Wissa': ['ST', 82, 29],
  'Nick Woltemade': ['ST', 82, 24], 'Deniz Undav': ['ST', 82, 30], 'Patrick Schick': ['ST', 82, 30], 'Christoph Baumgartner': ['OM', 81, 27], 
  'Can Uzun': ['OM', 81, 21], 'Tom Bischof': ['ZM', 80, 21], 'Lennart Karl': ['RA', 79, 18], 'Aleksandar Pavlović': ['DM', 84, 22], 'Konrad Laimer': ['RV', 83, 29], 'Serge Gnabry': ['RA', 82, 31],

  // Spain
  'Kylian Mbappé': ['ST', 91, 27], 'Vinícius Júnior': ['LA', 89, 26], 'Jude Bellingham': ['OM', 89, 23], 'Federico Valverde': ['ZM', 87, 28], 'Thibaut Courtois': ['TW', 88, 34],
  'Aurélien Tchouaméni': ['DM', 85, 26], 'Arda Güler': ['OM', 84, 21], 'Dean Huijsen': ['IV', 83, 21], 'Trent Alexander-Arnold': ['RV', 85, 28], 'Antonio Rüdiger': ['IV', 84, 33],
  'Éder Militão': ['IV', 84, 28], 'Rodrygo': ['RA', 84, 25], 'Eduardo Camavinga': ['ZM', 83, 24], 'Ibrahima Konaté': ['IV', 85, 27], 'Marc Cucurella': ['LV', 84, 28], 'Bernardo Silva': ['ZM', 85, 32],
  'Lamine Yamal': ['RA', 90, 19], 'Pedri': ['ZM', 89, 23], 'Raphinha': ['LA', 88, 29], 'Frenkie de Jong': ['ZM', 86, 29], 'Pau Cubarsí': ['IV', 84, 19], 'Jules Koundé': ['RV', 85, 27],
  'Joan Garcia': ['TW', 84, 25], 'Dani Olmo': ['OM', 84, 28], 'Alejandro Balde': ['LV', 83, 23], 'Gavi': ['ZM', 82, 22], 'Fermín López': ['OM', 82, 23], 'Marc-André ter Stegen': ['TW', 83, 34],
  'Julián Alvarez': ['ST', 87, 26], 'Jan Oblak': ['TW', 87, 33], 'Koke': ['ZM', 80, 34], 'Alexander Sørloth': ['ST', 82, 30], 'Cristian Romero': ['IV', 85, 28], 'Ademola Lookman': ['LA', 83, 29],
  'Nico Williams': ['LA', 85, 24], 'Unai Simón': ['TW', 84, 29], 'Mikel Oyarzabal': ['ST', 83, 29], 'Takefusa Kubo': ['RA', 82, 25], 'Isco': ['OM', 81, 34], 'Iago Aspas': ['ST', 78, 39],
  // Italy
  'Lautaro Martínez': ['ST', 88, 29], 'Alessandro Bastoni': ['IV', 86, 27], 'Nicolò Barella': ['ZM', 86, 29], 'Hakan Çalhanoğlu': ['DM', 84, 32], 'Marcus Thuram': ['ST', 84, 29], 'Federico Dimarco': ['LV', 84, 28],
  'Kevin De Bruyne': ['OM', 85, 35], 'Scott McTominay': ['ZM', 85, 29], 'Stanislav Lobotka': ['DM', 83, 31], 'Rasmus Højlund': ['ST', 81, 23], 'Alessandro Buongiorno': ['IV', 82, 27], 'Giovanni Di Lorenzo': ['RV', 82, 33],
  'Kenan Yıldız': ['LA', 85, 21], 'Bremer': ['IV', 84, 29], 'Teun Koopmeiners': ['ZM', 82, 28], 'Mike Maignan': ['TW', 86, 31], 'Luka Modrić': ['ZM', 82, 41],
  'Christian Pulisic': ['RA', 84, 28], 'Rafael Leão': ['LA', 85, 27], 'Adrien Rabiot': ['ZM', 82, 31], 'Nico Paz': ['OM', 83, 22], 'Moise Kean': ['ST', 82, 26], 'Paulo Dybala': ['OM', 81, 32], 'Mile Svilar': ['TW', 84, 27],
  // France
  'Ousmane Dembélé': ['RA', 89, 29], 'Khvicha Kvaratskhelia': ['LA', 87, 25], 'Vitinha': ['ZM', 88, 26], 'Achraf Hakimi': ['RV', 87, 28], 'Nuno Mendes': ['LV', 86, 24], 'Marquinhos': ['IV', 85, 32],
  'João Neves': ['ZM', 86, 22], 'Désiré Doué': ['RA', 85, 21], 'Willian Pacho': ['IV', 84, 25], 'Lucas Chevalier': ['TW', 84, 25], 'Warren Zaïre-Emery': ['ZM', 82, 20], 'Fabián Ruiz': ['ZM', 83, 30],
  'Paul Pogba': ['ZM', 78, 33], 'Olivier Giroud': ['ST', 76, 40], 'Pierre-Emile Højbjerg': ['DM', 80, 31], 'Mason Greenwood': ['RA', 83, 25],
  // England extra
  'Jack Grealish': ['LA', 80, 31], 'Jordan Pickford': ['TW', 82, 32], 'Jarrod Bowen': ['RA', 82, 29], 'Granit Xhaka': ['ZM', 81, 34], 'Kieran Trippier': ['RV', 77, 36], 'Kyle Walker': ['RV', 77, 36],

  // fix positions for wing-backs listed as DF
  'Jeremie Frimpong': ['RV', 83, 25], 'Milos Kerkez': ['LV', 82, 22], 'Conor Bradley': ['RV', 79, 23], 'Joe Gomez': ['IV', 80, 29],
  'Edin Džeko': ['ST', 77, 40], 'Kevin Müller': ['TW', 74, 35], 'Grischa Prömel': ['ZM', 77, 31],
};
