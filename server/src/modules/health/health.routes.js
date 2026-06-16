export function registerHealthRoutes(app) {
  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      service: "share-file-signaling",
      timestamp: new Date().toISOString(),
    });
  });
}

