"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  decodeSearchParams,
  encodeSearchParams,
  getSearchCacheKey,
} from "../lib/search-url.mjs";

type SearchResponse = {
  meta: {
    destination: string;
    checkIn: string;
    checkOut: string;
    priceCapPerNight: number;
    currency: string;
    totalResults: number;
    page: number;
  };
  results: {
    propertyId: string;
    name: string;
    propertyType: string;
    reviewScore: number;
    reviewCount: number;
    freeCancellation: boolean;
    pricePerNight: number;
    totalPrice: number;
    distanceFromCentreKm: number;
  }[];
};

type SearchState = {
  dest: string;
  checkin: string;
  checkout: string;
  guests: number;
  rooms: number;
  maxprice?: number;
};

async function fetchSearch(state: SearchState): Promise<SearchResponse> {
  const params = new URLSearchParams({
    destination: state.dest,
    checkIn: state.checkin,
    checkOut: state.checkout,
    priceCapPerNight: String(state.maxprice ?? 1000),
    guests: String(state.guests),
    rooms: String(state.rooms),
  });

  const response = await fetch(`/api/search?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Search request failed");
  }

  return response.json();
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = decodeSearchParams(searchParams) as SearchState;
  const canonicalQuery = encodeSearchParams(search);

  const { data, isLoading, error } = useQuery({
    queryKey: getSearchCacheKey(search),
    queryFn: () => fetchSearch(search),
    staleTime: Infinity,
  });

  function updateField(key: string, rawValue: string) {
    const nextParams = new URLSearchParams(canonicalQuery);

    if (rawValue === "") {
      nextParams.delete(key);
    } else {
      nextParams.set(key, rawValue);
    }

    const normalized = decodeSearchParams(nextParams);
    router.push(`/?${encodeSearchParams(normalized)}`, { scroll: false });
  }

  async function copyLink() {
    const url = `${window.location.origin}/?${canonicalQuery}`;
    await navigator.clipboard.writeText(url);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Trip planner
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Find your stay
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
            The filters below are reconstructed from the URL and every change is
            written back without a page reload.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <label className="lg:col-span-2">
              <span className="mb-1 block text-sm font-medium">Destination</span>
              <input
                value={search.dest}
                onChange={(event) => updateField("dest", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium">Check-in</span>
              <input
                type="date"
                value={search.checkin}
                onChange={(event) => updateField("checkin", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium">Check-out</span>
              <input
                type="date"
                value={search.checkout}
                onChange={(event) => updateField("checkout", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium">Guests</span>
              <input
                type="number"
                min="1"
                max="10"
                value={search.guests}
                onChange={(event) => updateField("guests", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium">Rooms</span>
              <input
                type="number"
                min="1"
                max="5"
                value={search.rooms}
                onChange={(event) => updateField("rooms", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="md:col-span-2 lg:col-span-2">
              <span className="mb-1 block text-sm font-medium">
                Maximum price / night
              </span>
              <input
                type="number"
                min="1"
                max="1000"
                placeholder="No limit"
                value={search.maxprice ?? ""}
                onChange={(event) => updateField("maxprice", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>
        </section>

        <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Shareable search URL
            </p>
            <code className="mt-1 block overflow-x-auto whitespace-nowrap text-sm text-slate-700">
              /?{canonicalQuery}
            </code>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Copy link
          </button>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Stays in {search.dest}</h2>
              <p className="text-sm text-slate-600">
                {search.checkin} → {search.checkout} · {search.guests} guest
                {search.guests === 1 ? "" : "s"} · {search.rooms} room
                {search.rooms === 1 ? "" : "s"}
                {search.maxprice ? ` · up to €${search.maxprice}/night` : ""}
              </p>
            </div>
          </div>

          {isLoading && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
              Loading accommodation…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
              Search failed.
            </div>
          )}

          {data && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.results.map((property) => (
                <article
                  key={property.propertyId}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm text-slate-500">{property.propertyType}</p>
                  <h3 className="mt-1 text-lg font-semibold">{property.name}</h3>
                  <p className="mt-3 text-sm">
                    ⭐ {property.reviewScore} · {property.reviewCount} reviews
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {property.distanceFromCentreKm} km from centre
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {property.freeCancellation
                      ? "Free cancellation"
                      : "Non-refundable"}
                  </p>
                  <p className="mt-4 text-lg font-bold">
                    €{property.pricePerNight}
                    <span className="text-sm font-normal text-slate-500">
                      {" "}
                      / night
                    </span>
                  </p>
                  <p className="text-sm text-slate-600">
                    €{property.totalPrice} total
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<main className="p-8">Loading…</main>}>
      <SearchPageContent />
    </Suspense>
  );
}
