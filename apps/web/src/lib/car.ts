/** CAR filing deadline (PRD §1): 31 March 2027, end of day in Lagos (WAT, UTC+1). */
export const CAR_DEADLINE = Date.UTC(2027, 2, 31, 22, 59, 59);
export const daysToCar = (now: number) => Math.max(0, Math.ceil((CAR_DEADLINE - now) / 864e5));
