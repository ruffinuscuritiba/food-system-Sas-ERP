import { NextRequest }
from "next/server";

import { NextResponse }
from "next/server";

export function proxy(
  request: NextRequest,
) {

  const token =
    request.cookies.get(
      "token",
    )?.value;

  const pathname =
    request.nextUrl.pathname;

  const publicRoutes = [
    "/login",
  ];

  const isPublicRoute =
    publicRoutes.includes(
      pathname,
    );

  if (
    !token &&
    !isPublicRoute
  ) {

    return NextResponse.redirect(

      new URL(
        "/login",
        request.url,
      ),
    );
  }

  if (
    token &&
    pathname === "/login"
  ) {

    return NextResponse.redirect(

      new URL(
        "/",
        request.url,
      ),
    );
  }

  return NextResponse.next();
}

export const config = {

  matcher: [

    "/",

    "/products/:path*",

    "/categories/:path*",

    "/orders/:path*",

    "/kitchen/:path*",

    "/tables/:path*",

    "/login",
  ],
};