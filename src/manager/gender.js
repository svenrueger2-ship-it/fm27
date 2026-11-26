// v6.0 Frauen-Fußball: women's and men's football are separate worlds – no transfers, scouting,
// rumours or national-team call-ups across them.
export const isW = (x) => !!x?.women;
export const genderOk = (club, p) => !!club?.women === !!p?.women;
// women's market: values and incomes on a much smaller scale than the men's game
export const W_SCALE = 0.06;
export const wScale = (x) => (x?.women ? W_SCALE : 1);
export const userIsW = (world) => !!world.clubs?.[world.userClubId]?.women;

const FEM = {
  GER: ['Lena', 'Laura', 'Sophie', 'Anna', 'Lea', 'Julia', 'Sarah', 'Lina', 'Marie', 'Hannah', 'Emilia', 'Klara', 'Nina', 'Jule', 'Sydney', 'Giulia', 'Kathrin', 'Svenja', 'Paulina', 'Vivien', 'Selina', 'Alara', 'Janina', 'Pia', 'Franziska'],
  ENG: ['Lucy', 'Ella', 'Chloe', 'Millie', 'Lauren', 'Beth', 'Jess', 'Alex', 'Georgia', 'Leah', 'Hannah', 'Grace', 'Niamh', 'Jessica', 'Katie', 'Esme', 'Maya', 'Aggie', 'Freya', 'Lotte', 'Rachel', 'Fran', 'Mary', 'Ebony'],
  SCO: ['Erin', 'Caroline', 'Kirsty', 'Rachel', 'Fiona', 'Martha', 'Emma', 'Lisa', 'Sam', 'Nicola'],
  ESP: ['Alexia', 'Aitana', 'Irene', 'Mariona', 'Patri', 'Ona', 'Laia', 'Olga', 'Salma', 'Cata', 'Teresa', 'Lucía', 'Claudia', 'Esther', 'Marta', 'Vicky', 'Sheila', 'Alba'],
  ITA: ['Cristiana', 'Barbara', 'Valentina', 'Manuela', 'Arianna', 'Martina', 'Elena', 'Giulia', 'Sofia', 'Chiara', 'Lucia', 'Benedetta'],
  FRA: ['Wendie', 'Eugénie', 'Kadidiatou', 'Sakina', 'Grace', 'Selma', 'Clara', 'Marie-Antoinette', 'Pauline', 'Maëlle', 'Sandy', 'Delphine', 'Amel', 'Inès', 'Léa'],
  NED: ['Vivianne', 'Lieke', 'Jill', 'Daniëlle', 'Esmee', 'Victoria', 'Jackie', 'Dominique', 'Kerstin', 'Damaris', 'Lineth', 'Sherida', 'Romée', 'Wieke'],
  POR: ['Kika', 'Dolores', 'Tatiana', 'Jéssica', 'Ana', 'Andreia', 'Carole', 'Lúcia', 'Inês'],
  BRA: ['Marta', 'Kerolin', 'Debinha', 'Bia', 'Ary', 'Geyse', 'Tarciane', 'Lauren', 'Duda', 'Antônia'],
  USA: ['Alex', 'Mallory', 'Sophia', 'Trinity', 'Lindsey', 'Rose', 'Naomi', 'Emily', 'Catarina', 'Jaedyn', 'Lily', 'Casey'],
  AUT: ['Sarah', 'Laura', 'Viktoria', 'Nicole', 'Barbara', 'Marie', 'Eileen', 'Annabel', 'Virginia'],
  SUI: ['Lia', 'Ana-Maria', 'Géraldine', 'Riola', 'Sydney', 'Noelle', 'Iman', 'Svenja'],
  DEN: ['Pernille', 'Signe', 'Sofie', 'Amalie', 'Emma', 'Kathrine', 'Janni', 'Rikke'],
  SWE: ['Fridolina', 'Stina', 'Kosovare', 'Magdalena', 'Hanna', 'Filippa', 'Johanna', 'Rebecka', 'Nathalie', 'Zećira'],
  NOR: ['Ada', 'Caroline', 'Guro', 'Frida', 'Maren', 'Tuva', 'Ingrid', 'Thea', 'Vilde'],
  BEL: ['Tessa', 'Janice', 'Justine', 'Tine', 'Marie', 'Elena', 'Amber', 'Sari'],
  JPN: ['Yui', 'Hinata', 'Mina', 'Fuka', 'Riko', 'Aoba', 'Hikaru', 'Saki', 'Momoko', 'Maika'],
  AUS: ['Sam', 'Ellie', 'Mary', 'Caitlin', 'Steph', 'Kyra', 'Hayley', 'Clare', 'Cortnee', 'Teagan'],
  CAN: ['Jessie', 'Ashley', 'Adriana', 'Julia', 'Kadeisha', 'Vanessa', 'Cloé', 'Olivia'],
  NGA: ['Asisat', 'Rasheedat', 'Chiamaka', 'Michelle', 'Toni', 'Uchenna', 'Ifeoma'],
};
const FEM_ANY = ['Emma', 'Mia', 'Sara', 'Nora', 'Lisa', 'Eva', 'Ana', 'Lina', 'Maya', 'Zoe', 'Elena', 'Nadia', 'Amira', 'Leonie', 'Jana', 'Ida', 'Luana', 'Olivia', 'Aya', 'Noemi'];
const pick = (rng, a) => a[Math.floor((rng?.next ? rng.next() : Math.random()) * a.length)];
/** Turns a freshly generated player into a women's footballer (name, looks, pay scale). */
export function feminize(rng, p) {
  p.women = true;
  if (!p.real) p.firstName = pick(rng, FEM[p.nation] || FEM_ANY);
  p.looks = { ...(p.looks || {}), beard: false, long: (rng?.next ? rng.next() : Math.random()) < 0.75, height: Math.round(clamp((p.looks?.height || 178) - 10, 158, 188)) };
  p.wage = Math.max(6000, Math.round((p.wage * 0.03) / 1000) * 1000);
  if (p.value) p.value = Math.round((p.value * W_SCALE) / 1e4) * 1e4;
  return p;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
