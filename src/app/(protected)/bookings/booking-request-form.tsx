"use client";

import { useState } from "react";
import { requestBooking } from "./actions";
import ResourceAvailabilityCalendar from "./resource-availability-calendar";

type BookingRequestFormProps = {
  resources: {
    id: string;
    name: string;
    location: string;
    operationalStatus: "AVAILABLE" | "IN_MAINTENANCE" | "BROKEN";
  }[];
};

function toLocalDateTimeValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function toUtcValue(localValue: string) {
  return localValue ? new Date(localValue).toISOString() : "";
}

export default function BookingRequestForm({ resources }: BookingRequestFormProps) {
  const [minimumStart] = useState(() => {
    const earliestStart = new Date();
    earliestStart.setSeconds(0, 0);
    earliestStart.setMinutes(earliestStart.getMinutes() + 1);
    return toLocalDateTimeValue(earliestStart);
  });
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const locations = [...new Set(resources.map((resource) => resource.location))];
  const locationResources = resources.filter((resource) => resource.location === selectedLocation);
  const selectedResource = locationResources.find((resource) => resource.id === selectedResourceId);
  const isSelectedResourceAvailable = selectedResource?.operationalStatus === "AVAILABLE";
  const minimumEnd = startLocal
    ? toLocalDateTimeValue(new Date(new Date(startLocal).getTime() + 60_000))
    : minimumStart;

  return (
    <form className="booking-form" action={requestBooking}>
      <label htmlFor="booking-location">
        Local
        <select
          id="booking-location"
          required
          value={selectedLocation}
          onChange={(event) => {
            setSelectedLocation(event.target.value);
            setSelectedResourceId("");
          }}
        >
          <option value="" disabled>Selecione um local</option>
          {locations.map((location) => (
            <option key={location} value={location}>{location}</option>
          ))}
        </select>
      </label>
      <label htmlFor="booking-resource">
        Recurso
        <select
          id="booking-resource"
          name="resourceId"
          required
          disabled={!selectedLocation}
          value={selectedResourceId}
          onChange={(event) => setSelectedResourceId(event.target.value)}
        >
          <option value="" disabled>
            {selectedLocation ? "Selecione um recurso" : "Selecione um local primeiro"}
          </option>
          {locationResources.map((resource) => (
            <option
              key={resource.id}
              value={resource.id}
              disabled={resource.operationalStatus !== "AVAILABLE"}
            >
              {resource.name}{resource.operationalStatus === "IN_MAINTENANCE"
                ? " — Em manutenção"
                : resource.operationalStatus === "BROKEN"
                  ? " — Quebrado"
                  : ""}
            </option>
          ))}
        </select>
      </label>
      {isSelectedResourceAvailable && (
        <ResourceAvailabilityCalendar key={selectedResource.id} resourceId={selectedResource.id} />
      )}
      <div className="booking-time-fields">
        <label>
          Início
          <input
            type="datetime-local"
            required
            min={minimumStart}
            step={60}
            value={startLocal}
            onChange={(event) => setStartLocal(event.target.value)}
          />
          <input type="hidden" name="startsAt" value={toUtcValue(startLocal)} />
        </label>
        <label>
          Término
          <input
            type="datetime-local"
            required
            min={minimumEnd}
            step={60}
            value={endLocal}
            onChange={(event) => setEndLocal(event.target.value)}
          />
          <input type="hidden" name="endsAt" value={toUtcValue(endLocal)} />
        </label>
      </div>
      <button type="submit" disabled={!isSelectedResourceAvailable}>
        Enviar solicitação
      </button>
    </form>
  );
}