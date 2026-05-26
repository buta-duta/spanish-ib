import { Router, type IRouter } from "express";
import { createSiteSessionToken, verifySitePassword } from "../siteAuth";

const router: IRouter = Router();

router.post("/auth/unlock", (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password) {
    return res.status(400).json({ error: "Password required." });
  }

  try {
    if (!verifySitePassword(password)) {
      return res.status(401).json({ error: "Incorrect password." });
    }
    return res.json({ token: createSiteSessionToken() });
  } catch (err) {
    console.error("auth/unlock error:", err);
    return res.status(500).json({ error: "Site authentication is not configured." });
  }
});

export default router;
