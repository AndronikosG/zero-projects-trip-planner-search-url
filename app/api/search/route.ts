import { NextRequest, NextResponse } from "next/server";

type Accommodation = {
  propertyId: string;
  name: string;
  propertyType: string;
  reviewScore: number;
  reviewCount: number;
  freeCancellation: boolean;
  pricePerNight: number;
  totalPrice: number;
  distanceFromCentreKm: number;
};

function hashString(value: string): number {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);

  const nights = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  return Math.max(1, nights);
}

function generateResults(
  destination: string,
  checkIn: string,
  checkOut: string,
  priceCapPerNight: number,
  guests: number,
  rooms: number,
): Accommodation[] {
  const seedSource = `${destination}|${checkIn}|${checkOut}|${priceCapPerNight}|${guests}|${rooms}`;
  const random = createRandom(hashString(seedSource));
  const nights = nightsBetween(checkIn, checkOut);

  const propertyTypes = [
    "Hotel",
    "Guesthouse",
    "Apartment",
    "Aparthotel",
    "Hostel",
  ];

  const nameEndings = [
    "Central Hotel",
    "Garden Rooms",
    "City Apartments",
    "Riverside Stay",
    "Old Town Residence",
  ];

  return Array.from({ length: 3 }, (_, index) => {
    const maxPrice = Math.max(1, priceCapPerNight);
    const pricePerNight = Math.max(
      1,
      Math.floor(maxPrice * (0.55 + random() * 0.4)),
    );

    return {
      propertyId: `${destination
        .slice(0, 3)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "x")}-${1000 + Math.floor(random() * 9000)}`,
      name: `${destination} ${nameEndings[Math.floor(random() * nameEndings.length)]}`,
      propertyType: propertyTypes[Math.floor(random() * propertyTypes.length)],
      reviewScore: Number((7.5 + random() * 2.3).toFixed(1)),
      reviewCount: 100 + Math.floor(random() * 4900),
      freeCancellation: random() >= 0.5,
      pricePerNight,
      totalPrice: pricePerNight * nights,
      distanceFromCentreKm: Number((0.2 + random() * 4.8).toFixed(1)),
    };
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const destination = searchParams.get("destination") ?? "";
  const checkIn = searchParams.get("checkIn") ?? "";
  const checkOut = searchParams.get("checkOut") ?? "";

  const parsedPriceCap = Number(searchParams.get("priceCapPerNight"));
  const priceCapPerNight = Number.isFinite(parsedPriceCap) ? parsedPriceCap : 0;

  const parsedGuests = Number(searchParams.get("guests"));
  const guests = Number.isInteger(parsedGuests) && parsedGuests > 0 ? parsedGuests : 2;

  const parsedRooms = Number(searchParams.get("rooms"));
  const rooms = Number.isInteger(parsedRooms) && parsedRooms > 0 ? parsedRooms : 1;

  const results = generateResults(
    destination,
    checkIn,
    checkOut,
    priceCapPerNight,
    guests,
    rooms,
  );

  const payload = {
    meta: {
      destination,
      checkIn,
      checkOut,
      priceCapPerNight,
      currency: "EUR",
      totalResults: results.length,
      page: 1,
    },
    results,
  };

  console.log("[accommodation-search]", {
    timestamp: new Date().toISOString(),
    destination,
    checkIn,
    checkOut,
    priceCapPerNight,
    guests,
    rooms,
  });

  await new Promise((resolve) => setTimeout(resolve, 600));

  return NextResponse.json(payload);
}
