"use client";

import { useEffect, useRef, useState } from "react";

type AvailabilityBooking = {
  startsAt: string;
  endsAt: string;
  status: "PENDING" | "APPROVED";
};

type ResourceAvailabilityCalendarProps = {
  resourceId: string;
};

const weekDays = [
  { short: "Dom", full: "domingo" },
  { short: "Seg", full: "segunda-feira" },
  { short: "Ter", full: "terça-feira" },
  { short: "Qua", full: "quarta-feira" },
  { short: "Qui", full: "quinta-feira" },
  { short: "Sex", full: "sexta-feira" },
  { short: "Sáb", full: "sábado" },
];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAccessibleDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function moveByMonths(date: Date, amount: number) {
  const targetMonth = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  targetMonth.setDate(Math.min(date.getDate(), lastDay));
  return targetMonth;
}

export default function ResourceAvailabilityCalendar({ resourceId }: ResourceAvailabilityCalendarProps) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
  const [bookings, setBookings] = useState<AvailabilityBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const dayButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const shouldFocusSelectedDay = useRef(false);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);

    fetch(`/api/resources/${encodeURIComponent(resourceId)}/bookings?month=${monthKey}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Availability request failed");
        }
        return response.json() as Promise<AvailabilityBooking[]>;
      })
      .then((data) => setBookings(data))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [resourceId, monthKey]);

  useEffect(() => {
    if (!shouldFocusSelectedDay.current) {
      return;
    }

    dayButtonRefs.current.get(selectedDay)?.focus();
    shouldFocusSelectedDay.current = false;
  }, [monthKey, selectedDay]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(month);

  function bookingsForDay(day: number) {
    const startOfDay = new Date(year, monthIndex, day);
    const endOfDay = new Date(year, monthIndex, day + 1);
    return bookings.filter((booking) => {
      const start = new Date(booking.startsAt);
      const end = new Date(booking.endsAt);
      return start < endOfDay && end > startOfDay;
    });
  }

  const selectedDate = new Date(`${selectedDay}T00:00:00`);
  const selectedBookings = bookingsForDay(selectedDate.getDate());
  const selectedPendingCount = selectedBookings.filter((booking) => booking.status === "PENDING").length;
  const selectedApprovedCount = selectedBookings.filter((booking) => booking.status === "APPROVED").length;

  function changeMonth(offset: number) {
    const nextMonth = new Date(year, monthIndex + offset, 1);
    setMonth(nextMonth);
    setSelectedDay(dateKey(nextMonth));
  }

  function selectAndFocusDate(date: Date) {
    shouldFocusSelectedDay.current = true;
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setSelectedDay(dateKey(date));
  }

  function onDayKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, date: Date) {
    let targetDate: Date | undefined;

    switch (event.key) {
      case "ArrowLeft":
        targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
        break;
      case "ArrowRight":
        targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        break;
      case "ArrowUp":
        targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7);
        break;
      case "ArrowDown":
        targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
        break;
      case "Home": {
        targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
        break;
      }
      case "End": {
        targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 6 - date.getDay());
        break;
      }
      case "PageUp":
        targetDate = moveByMonths(date, event.shiftKey ? -12 : -1);
        break;
      case "PageDown":
        targetDate = moveByMonths(date, event.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }

    event.preventDefault();
    selectAndFocusDate(targetDate);
  }

  const selectedDayAnnouncement = loading
    ? `Carregando reservas para ${formatAccessibleDate(selectedDate)}.`
    : loadError
      ? `Não foi possível carregar as reservas para ${formatAccessibleDate(selectedDate)}.`
      : `${formatAccessibleDate(selectedDate)}. ${selectedBookings.length} ${selectedBookings.length === 1 ? "reserva" : "reservas"}: ${selectedPendingCount} ${selectedPendingCount === 1 ? "pendente" : "pendentes"} e ${selectedApprovedCount} ${selectedApprovedCount === 1 ? "aprovada" : "aprovadas"}.`;

  return (
    <section className="availability-calendar" aria-labelledby="availability-heading">
      <div className="availability-heading">
        <div>
          <p className="eyebrow">Disponibilidade</p>
          <h2 id="availability-heading">Reservas existentes</h2>
        </div>
        <div className="availability-month-controls" role="group" aria-label="Navegação entre meses">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Mês anterior" title="Mês anterior">
            <span aria-hidden="true">←</span>
          </button>
          <p aria-live="polite">{monthLabel}</p>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Próximo mês" title="Próximo mês">
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div className="availability-legend" role="group" aria-label="Legenda do calendário">
        <span><i className="is-pending" aria-hidden="true" /> Pendente</span>
        <span><i className="is-approved" aria-hidden="true" /> Aprovada</span>
      </div>

      <p id="availability-instructions" className="availability-screen-reader-only">
        Use as setas para navegar entre os dias, Home e End para ir ao início ou fim da semana, e Page Up ou Page Down para mudar de mês. Shift mais Page Up ou Page Down muda de ano.
      </p>
      <div className="availability-days" role="grid" aria-labelledby="availability-heading" aria-describedby="availability-instructions">
        <div className="availability-weekdays" role="row">
          {weekDays.map((day) => (
            <span role="columnheader" aria-label={day.full} key={day.short}>{day.short}</span>
          ))}
        </div>
        {Array.from({ length: cellCount / 7 }, (_, weekIndex) => (
          <div className="availability-week" role="row" key={`week-${weekIndex}`}>
            {Array.from({ length: 7 }, (_, weekdayIndex) => {
              const day = weekIndex * 7 + weekdayIndex - firstWeekday + 1;

              if (day < 1 || day > daysInMonth) {
                return <div className="availability-day is-empty" role="gridcell" aria-disabled="true" key={`empty-${weekIndex}-${weekdayIndex}`} />;
              }

              const date = new Date(year, monthIndex, day);
              const key = dateKey(date);
              const dayBookings = bookingsForDay(day);
              const pendingCount = dayBookings.filter((booking) => booking.status === "PENDING").length;
              const approvedCount = dayBookings.filter((booking) => booking.status === "APPROVED").length;
              const isSelected = key === selectedDay;
              const isToday = key === dateKey(new Date());
              const dayDescription = `${formatAccessibleDate(date)}${isToday ? ", hoje" : ""}. ${dayBookings.length} ${dayBookings.length === 1 ? "reserva" : "reservas"}: ${pendingCount} ${pendingCount === 1 ? "pendente" : "pendentes"} e ${approvedCount} ${approvedCount === 1 ? "aprovada" : "aprovadas"}.`;

              return (
                <div className="availability-day-cell" role="gridcell" aria-selected={isSelected} key={key}>
                  <button
                    ref={(element) => {
                      if (element) {
                        dayButtonRefs.current.set(key, element);
                      } else {
                        dayButtonRefs.current.delete(key);
                      }
                    }}
                    className={`availability-day${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
                    type="button"
                    tabIndex={isSelected ? 0 : -1}
                    aria-label={dayDescription}
                    aria-current={isToday ? "date" : undefined}
                    onClick={() => setSelectedDay(key)}
                    onKeyDown={(event) => onDayKeyDown(event, date)}
                  >
                    <span aria-hidden="true">{day}</span>
                    {dayBookings.length > 0 && (
                      <span className="availability-day-markers" aria-hidden="true">
                        {dayBookings.slice(0, 3).map((booking, markerIndex) => (
                          <i
                            key={`${booking.startsAt}-${markerIndex}`}
                            className={booking.status === "PENDING" ? "is-pending" : "is-approved"}
                          />
                        ))}
                        {dayBookings.length > 3 && <small>+{dayBookings.length - 3}</small>}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="availability-screen-reader-only" role="status" aria-live="polite" aria-atomic="true">
        {selectedDayAnnouncement}
      </p>

      <div className="availability-day-details" aria-busy={loading}>
        <h3>{formatAccessibleDate(selectedDate)}</h3>
        {loading ? (
          <p>Carregando reservas...</p>
        ) : loadError ? (
          <p>Não foi possível carregar as reservas deste recurso.</p>
        ) : selectedBookings.length === 0 ? (
          <p>Nenhuma reserva pendente ou aprovada neste dia.</p>
        ) : (
          <ul>
            {selectedBookings.map((booking) => {
              const start = new Date(booking.startsAt);
              const end = new Date(booking.endsAt);
              const crossesDate = dateKey(start) !== dateKey(end);
              const interval = crossesDate
                ? `${formatDateTime(start)} – ${formatDateTime(end)}`
                : `${formatTime(start)} – ${formatTime(end)}`;

              return (
                <li key={`${booking.startsAt}-${booking.endsAt}`}>
                  <time>{interval}</time>
                  <span className={`booking-state is-${booking.status.toLowerCase()}`}>
                    {booking.status === "PENDING" ? "Pendente" : "Aprovada"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}