export default function handler(req, res) {
  res.setHeader("Set-Cookie", "cl_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return res.redirect(302, "/login.html");
}
