const authService = require('../services/authService');

async function signup(req, res) {
  const result = await authService.signup(req.body);

  res.status(201).json({
    ok: true,
    message: 'Account created successfully.',
    token: result.token,
    user: result.user,
  });
}

async function login(req, res) {
  const result = await authService.login(req.body);

  res.json({
    ok: true,
    message: 'Signed in successfully.',
    token: result.token,
    user: result.user,
  });
}

async function me(req, res) {
  res.json({
    ok: true,
    user: req.publicUser,
  });
}

async function logout(req, res) {
  res.json({
    ok: true,
    message: 'Signed out.',
  });
}

module.exports = {
  login,
  logout,
  me,
  signup,
};
