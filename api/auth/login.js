export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirect = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo`;
  res.redirect(redirect);
}