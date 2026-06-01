export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectParam = req.query.redirect || "/";

  const authorizeUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${clientId}` +
    `&scope=repo` +
    `&prompt=login` + // force re-auth
    `&redirect_uri=${encodeURIComponent(
        process.env.GITHUB_REDIRECT_URI + "?redirect=" + redirectParam
    )}`;

  res.redirect(authorizeUrl);
}
