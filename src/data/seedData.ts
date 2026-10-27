import { LocaleItem, SessionItem, MemberItem, AttendanceLogItem, AttendanceStatus } from '../types/lnatk';

export const INITIAL_LOCALES: LocaleItem[] = [
  // Santa Rosa (7)
  { id: 1, city: 'Santa Rosa', name: 'Dila', code: 'SR-DILA', coordinator: 'Marco Villanueva', contact: '0917-550-1101', pin: '1234', failedAttempts: 0, active: true },
  { id: 2, city: 'Santa Rosa', name: 'Macabling', code: 'SR-MCBL', coordinator: 'Clarisse Aquino', contact: '0917-550-1102', pin: '1234', failedAttempts: 0, active: true },
  { id: 3, city: 'Santa Rosa', name: 'Pulong Santa Cruz', code: 'SR-PSCZ', coordinator: 'Jomar Bautista', contact: '0917-550-1103', pin: '1234', failedAttempts: 0, active: true },
  { id: 4, city: 'Santa Rosa', name: 'Santa Rosa', code: 'SR-SROS', coordinator: 'Hannah Mendoza', contact: '0917-550-1104', pin: '1234', failedAttempts: 0, active: true },
  { id: 5, city: 'Santa Rosa', name: 'San Lorenzo', code: 'SR-SLOR', coordinator: 'Christian Ocampo', contact: '0917-550-1105', pin: '1234', failedAttempts: 0, active: true },
  { id: 6, city: 'Santa Rosa', name: 'Sinalhan', code: 'SR-SNLH', coordinator: 'Patricia Castro', contact: '0917-550-1106', pin: '1234', failedAttempts: 0, active: true },
  { id: 7, city: 'Santa Rosa', name: 'SV4', code: 'SR-SV04', coordinator: 'Ryan Tolentino', contact: '0917-550-1107', pin: '1234', failedAttempts: 0, active: true },
  // Biñan (7)
  { id: 8, city: 'Biñan', name: 'Canlalay', code: 'BN-CNLY', coordinator: 'Angela Soriano', contact: '0918-620-2201', pin: '1234', failedAttempts: 0, active: true },
  { id: 9, city: 'Biñan', name: 'Dela Paz', code: 'BN-DLPZ', coordinator: 'Kenneth Navarro', contact: '0918-620-2202', pin: '1234', failedAttempts: 0, active: true },
  { id: 10, city: 'Biñan', name: 'Loma', code: 'BN-LOMA', coordinator: 'Bea Salazar', contact: '0918-620-2203', pin: '1234', failedAttempts: 0, active: true },
  { id: 11, city: 'Biñan', name: 'Malaban', code: 'BN-MLBN', coordinator: 'Carlo Alcantara', contact: '0918-620-2204', pin: '1234', failedAttempts: 0, active: true },
  { id: 12, city: 'Biñan', name: 'Mamplasan', code: 'BN-MMPL', coordinator: 'Denise Pineda', contact: '0918-620-2205', pin: '1234', failedAttempts: 0, active: true },
  { id: 13, city: 'Biñan', name: 'Platero', code: 'BN-PLTR', coordinator: 'Gabriel Mercado', contact: '0918-620-2206', pin: '1234', failedAttempts: 0, active: true },
  { id: 14, city: 'Biñan', name: 'South City', code: 'BN-SCTY', coordinator: 'Katrina Flores', contact: '0918-620-2207', pin: '1234', failedAttempts: 0, active: true },
  // San Pedro (4)
  { id: 15, city: 'San Pedro', name: 'Calendola', code: 'SP-CLND', coordinator: 'Joshua Pascual', contact: '0919-740-3301', pin: '1234', failedAttempts: 0, active: true },
  { id: 16, city: 'San Pedro', name: 'Langgam', code: 'SP-LNGM', coordinator: 'Micaela Ramos', contact: '0919-740-3302', pin: '1234', failedAttempts: 0, active: true },
  { id: 17, city: 'San Pedro', name: 'Rosario', code: 'SP-RSRO', coordinator: 'Nathan Vergara', contact: '0919-740-3303', pin: '1234', failedAttempts: 0, active: true },
  { id: 18, city: 'San Pedro', name: 'San Pedro', code: 'SP-SPDR', coordinator: 'Joyce Evangelista', contact: '0919-740-3304', pin: '1234', failedAttempts: 0, active: true },
];

export const INITIAL_SESSIONS: SessionItem[] = [
  { id: 'w1-pm', type: 'PM', label: 'Week 1 PM', shortLabel: 'PM', date: '2026-09-30', weekNum: 1, code: null, confirmViewing: false, allowed: ['D', 'A', 'S', 'N'], statusWindow: 'closed' },
  { id: 'w1-ws', type: 'WS', label: 'Week 1 WS', shortLabel: 'WS', date: '2026-10-03', weekNum: 1, code: null, confirmViewing: false, allowed: ['D', 'A', 'S', 'N'], statusWindow: 'closed' },
  { id: 'w1-tg', type: 'TG', label: 'Week 1 TG', shortLabel: 'TG', date: '2026-10-03', weekNum: 1, code: 'TG-1003', confirmViewing: true, allowed: ['D', 'A', 'S', 'P', 'N'], statusWindow: 'closed' },
  { id: 'w2-pm', type: 'PM', label: 'Week 2 PM', shortLabel: 'PM', date: '2026-10-07', weekNum: 2, code: null, confirmViewing: false, allowed: ['D', 'A', 'S', 'N'], statusWindow: 'closed' },
  { id: 'w2-ws', type: 'WS', label: 'Week 2 WS', shortLabel: 'WS', date: '2026-10-10', weekNum: 2, code: null, confirmViewing: false, allowed: ['D', 'A', 'S', 'N'], statusWindow: 'closed' },
  { id: 'w2-tg', type: 'TG', label: 'Week 2 TG', shortLabel: 'TG', date: '2026-10-10', weekNum: 2, code: 'TG-1010', confirmViewing: true, allowed: ['D', 'A', 'S', 'P', 'N'], statusWindow: 'closed' },
  { id: 'w3-pm', type: 'PM', label: 'Week 3 PM', shortLabel: 'PM', date: '2026-10-14', weekNum: 3, code: null, confirmViewing: false, allowed: ['D', 'A', 'S', 'N'], statusWindow: 'closed' },
  { id: 'w3-ws', type: 'WS', label: 'Week 3 WS', shortLabel: 'WS', date: '2026-10-17', weekNum: 3, code: null, confirmViewing: false, allowed: ['D', 'A', 'S', 'N'], statusWindow: 'closed' },
  { id: 'w3-tg', type: 'TG', label: 'Week 3 TG', shortLabel: 'TG', date: '2026-10-17', weekNum: 3, code: 'TG-1017', confirmViewing: true, allowed: ['D', 'A', 'S', 'P', 'N'], statusWindow: 'closed' },
  { id: 'w4-pm', type: 'PM', label: 'Week 4 PM', shortLabel: 'PM', date: '2026-10-21', weekNum: 4, code: null, confirmViewing: false, allowed: ['D', 'A', 'S', 'N'], statusWindow: 'open' },
  { id: 'w4-ws', type: 'WS', label: 'Week 4 WS', shortLabel: 'WS', date: '2026-10-24', weekNum: 4, code: null, confirmViewing: false, allowed: ['D', 'A', 'S', 'N'], statusWindow: 'open' },
  { id: 'w4-tg', type: 'TG', label: 'Week 4 TG', shortLabel: 'TG', date: '2026-10-24', weekNum: 4, code: 'TG-8821', confirmViewing: true, allowed: ['D', 'A', 'S', 'P', 'N'], statusWindow: 'live' },
];

const FIRST_NAMES = ['Alyssa', 'Daniel', 'Mateo', 'Sofia', 'Gabriel', 'Camille', 'Lucas', 'Bianca', 'Ethan', 'Nadine', 'Rafael', 'Katrina', 'Miguel', 'Cheska', 'Paolo', 'Trisha', 'Andrei', 'Mika', 'Jericho', 'Zaira'];
const LAST_NAMES = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Mendoza', 'Delos Reyes', 'Villanueva', 'Ramos', 'Garcia', 'Flores', 'Gonzales', 'Salazar', 'Navarro', 'Mercado', 'Pascual', 'Vergara', 'Castillo'];

export function buildSeedData() {
  const members: MemberItem[] = [];
  const logs: Record<string, AttendanceLogItem> = {};
  let seq = 1;

  INITIAL_LOCALES.forEach((loc, idx) => {
    const count = loc.id === 1 ? 8 : loc.id <= 6 ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const mId = `m-${seq++}`;
      const fullName = `${LAST_NAMES[(idx + i) % LAST_NAMES.length]}, ${FIRST_NAMES[(idx * 3 + i) % FIRST_NAMES.length]}`;
      members.push({ id: mId, localeId: loc.id, fullName, joinedAt: '2026-01-15', leftAt: null });

      const pattern = i % 4 === 0 || i % 4 === 1 ? 'HIGH' : i % 4 === 2 ? 'MID' : 'NONE';
      INITIAL_SESSIONS.forEach((sess) => {
        let st: AttendanceStatus = 'S';
        if (pattern === 'HIGH') {
          st = sess.type === 'TG' && i === 0 && sess.weekNum === 4 ? 'P' : sess.type === 'PM' && i === 1 ? 'D' : 'S';
        } else if (pattern === 'MID') {
          st = sess.weekNum <= 2 && sess.type === 'TG' ? 'S' : 'D';
        } else {
          st = sess.weekNum % 2 === 0 ? 'D' : 'A';
        }
        logs[`${mId}_${sess.id}`] = {
          memberId: mId,
          sessionId: sess.id,
          status: st,
          source: i === 2 ? 'coordinator' : 'self',
          attendedVia: sess.type === 'TG' ? 'live' : null,
          confirmed: true,
          updatedAt: '2026-10-24 14:35',
        };
      });
    }
  });

  return { members, logs };
}
