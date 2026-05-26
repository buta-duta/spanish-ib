import { Router, type IRouter } from "express";
import { createSiteSessionToken, verifySitePassword } from "../siteAuth";

const router: IRouter = Router();

router.post("/auth/unlock", (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password) {
    return res.status(400).json({ error: "Introduce la contraseña." });
  }

  try {
    if (!verifySitePassword(password)) {
      return res.status(401).json({ error: "Contraseña incorrecta." });
    }
    return res.json({ token: createSiteSessionToken() });
  } catch (err) {
    console.error("auth/unlock error:", err);
    return res.status(500).json({
      error: "SITE_PASSWORD no está configurado. Añádelo en .env (local) o en Vercel → Environment Variables.",
    });
  }
});

export default router;
