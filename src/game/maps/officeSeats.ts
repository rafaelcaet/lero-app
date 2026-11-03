import { createOfficeLayout } from "./officeLayout";
import { computeSeats, type Seat } from "./seats";

/** Cadeiras do escritório (mesma fonte usada pelo servidor). */
export const OFFICE_SEATS: readonly Seat[] = computeSeats(createOfficeLayout());

export const SEAT_BY_ID: ReadonlyMap<string, Seat> = new Map(OFFICE_SEATS.map((s) => [s.id, s]));

export function tableIdOfSeat(seatId: string | null | undefined): string | null {
  return seatId ? (SEAT_BY_ID.get(seatId)?.tableId ?? null) : null;
}
