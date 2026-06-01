export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirect = req.query.redirect || "/";
  const url =
    `https://github.com/login/oauth/authorize?client_id=${clientId}` +
    `&scope=repo` +
    `&redirect_uri=${encodeURIComponent(process.env.GITHUB_REDIRECT_URI + "?redirect=" + redirect)}`;

  res.redirect(url);
}
