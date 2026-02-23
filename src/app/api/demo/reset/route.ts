import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { message: "Data is automatically seeded on each deployment. Re-deploy to reset data." },
    { status: 200 }
  );
}
