const defaultClientOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5180",
  "http://127.0.0.1:5180",
];

export const config = {
  port: Number.parseInt(process.env.PORT || "3000", 10),
  clientOrigins: process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim())
    : defaultClientOrigins,

  // Allow any origin in dev mode (CORS). In production, set CLIENT_ORIGIN
  // to restrict access.
  allowAllOrigins: !process.env.CLIENT_ORIGIN,
};

