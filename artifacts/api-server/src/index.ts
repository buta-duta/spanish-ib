import "./preamble.ts";
const { default: app } = await import("./app");

const rawPort = process.env["PORT"];
const isVercel = process.env.VERCEL === "1" || !!process.env.VERCEL_URL;

if (rawPort) {
  const port = Number(rawPort);
  if (!Number.isNaN(port) && port > 0) {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  }
} else if (!isVercel) {
  // Only throw if we are not on Vercel and no port is provided
  console.warn("No PORT provided, and not on Vercel. Server might not be listening.");
}

export default app;
