const resumeService = require('../services/resumeService');

async function saveResume(req, res) {
  const result = await resumeService.saveResume({
    authUser: req.user,
    body: req.body,
    guestId: req.body.guestId || req.headers['x-guest-id'],
  });

  res.status(result.wasCreated ? 201 : 200).json({
    ok: true,
    message: result.wasCreated ? 'Resume saved successfully.' : 'Resume updated successfully.',
    resume: result.resume,
  });
}

async function listResumes(req, res) {
  const resumes = await resumeService.listResumes({
    authUser: req.user,
    guestId: req.query.guestId || req.headers['x-guest-id'],
  });

  res.json({
    ok: true,
    resumes,
  });
}

async function getLatestResume(req, res) {
  const resume = await resumeService.getLatestResume({
    authUser: req.user,
    guestId: req.query.guestId || req.headers['x-guest-id'],
    type: req.query.type,
  });

  res.json({
    ok: true,
    resume,
  });
}

module.exports = {
  getLatestResume,
  listResumes,
  saveResume,
};
