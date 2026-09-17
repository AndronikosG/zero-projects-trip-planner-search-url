"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

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

async function fetchSearch(
  destination: string,
  checkIn: string,
  checkOut: string,
  priceCapPerNight: number,
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    destination,
    checkIn,
    checkOut,
    priceCapPerNight: String(priceCapPerNight),
  });

  const response = await fetch(`/api/search?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Search request failed");
  }

  return response.json();
}

function SearchPageContent() {
  const searchParams = useSearchParams();

  const destination = searchParams.get("destination") ?? "Lisbon";
  const checkIn = searchParams.get("checkIn") ?? "2024-08-09";
  const checkOut = searchParams.get("checkOut") ?? "2024-08-12";
  const priceCapPerNight = Number(
    searchParams.get("priceCapPerNight") ?? "180",
  );

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "accommodation-search",
      destination,
      checkIn,
      checkOut,
      priceCapPerNight,
    ],
    queryFn: () =>
      fetchSearch(destination, checkIn, checkOut, priceCapPerNight),
    staleTime: Infinity,
  });

  if (isLoading) {
    return <main className="p-8">Loading accommodation...</main>;
  }

  if (error || !data) {
    return <main className="p-8">Search failed.</main>;
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="mb-2 text-3xl font-bold">
        Stays in {data.meta.destination}
      </h1>

      <p className="mb-8 text-gray-600">
        {data.meta.checkIn} → {data.meta.checkOut} · Up to{" "}
        {data.meta.priceCapPerNight} {data.meta.currency}/night
      </p>

      <div className="mb-8 flex gap-3">
        <Link
          href="/?destination=Lisbon&checkIn=2024-08-09&checkOut=2024-08-12&priceCapPerNight=180"
          className="rounded border px-4 py-2"
        >
          Lisbon €180
        </Link>

        <Link
          href="/?destination=Lisbon&checkIn=2024-08-09&checkOut=2024-08-12&priceCapPerNight=160"
          className="rounded border px-4 py-2"
        >
          Lisbon €160
        </Link>
      </div>

      <div className="space-y-4">
        {data.results.map((property) => (
          <article
            key={property.propertyId}
            className="rounded-xl border p-5 shadow-sm"
          >
            <h2 className="text-xl font-semibold">{property.name}</h2>
            <p>{property.propertyType}</p>

            <p className="mt-2">
              ⭐ {property.reviewScore} ({property.reviewCount} reviews)
            </p>

            <p>{property.distanceFromCentreKm} km from centre</p>

            <p>
              {property.freeCancellation
                ? "Free cancellation"
                : "Non-refundable"}
            </p>

            <p className="mt-3 font-semibold">
              {property.pricePerNight} {data.meta.currency}/night
            </p>

            <p>
              Total: {property.totalPrice} {data.meta.currency}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <SearchPageContent />
    </Suspense>
  );
}
