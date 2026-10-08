import React, { useEffect, useState } from 'react';
import { apiGetMyBookings, apiGetRoomReservations } from '../services/api';

interface Props {
  onBack: () => void;
}

export const MyBookingsScreen: React.FC<Props> = ({ onBack }) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiGetMyBookings(), apiGetRoomReservations()])
      .then(([ticketResponse, roomResponse]) => {
        setTickets(ticketResponse.bookings || []);
        setRooms(roomResponse.rooms || []);
      })
      .catch((err) => {
        setError(err.message || 'Could not load your bookings.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="max-w-[1000px] mx-auto p-8">Loading your bookings…</div>;
  }

  return (
    <section className="max-w-[1000px] mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#001026]">My Bookings</h1>
          <p className="text-sm text-[#44474e]">Your train tickets and retiring-room reservations.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-[#001026] text-white font-semibold"
        >
          Back to Home
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">
          {error}
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-[#001026] mb-3">My Train Tickets</h2>

        {tickets.length === 0 ? (
          <div className="rounded-xl border bg-white p-5 text-[#44474e]">
            No train tickets found.
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-xl border border-[#dce9ff] bg-white p-5 shadow-sm">
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-bold text-[#001026]">
                      {ticket.trainNumber || ticket.train_number} {ticket.trainName || ticket.train_name}
                    </div>
                    <div className="text-sm text-[#44474e]">
                      {ticket.from} → {ticket.to}
                    </div>
                  </div>
                  <span className="h-fit rounded-full bg-[#e5eeff] px-3 py-1 text-xs font-bold">
                    {ticket.status}
                  </span>
                </div>

                <div className="mt-3 text-sm text-[#44474e]">
                  PNR: <b>{ticket.pnr}</b> · Date: {ticket.journeyDate || ticket.journey_date}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-[#001026] mb-3">My Room Reservations</h2>

        {rooms.length === 0 ? (
          <div className="rounded-xl border bg-white p-5 text-[#44474e]">
            No room reservations found.
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div key={room.id} className="rounded-xl border border-[#dce9ff] bg-white p-5 shadow-sm">
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-bold text-[#001026]">{room.room_type}</div>
                    <div className="text-sm text-[#44474e]">{room.station_name}</div>
                  </div>
                  <span className="h-fit rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                    {room.status}
                  </span>
                </div>

                <div className="mt-3 text-sm text-[#44474e]">
                  PNR: <b>{room.pnr}</b> · Check-in: {room.check_in_date}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};