// server/routes/system.js
import { Router } from 'express';
import { getNowInBusinessTimezone } from '../timezone.js';

const router = Router();

// GET timezone and server clock status
function handleTime(req, res) {
  const nowInfo = getNowInBusinessTimezone();

  res.json({
    timezone: nowInfo.timezone,
    currentServerTime: nowInfo.isoLike,
    currentDate: nowInfo.dateStr,
    currentTime: nowInfo.timeStr
  });
}

router.get('/time', handleTime);
router.get('/deadline-status', handleTime);

export default router;
