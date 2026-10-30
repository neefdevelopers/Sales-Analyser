// server/routes/system.js
import { Router } from 'express';
import { getNowInBusinessTimezone, checkActivityDeadline, getActivityDeadline } from '../timezone.js';

const router = Router();

// GET deadline & timezone status for current day and yesterday
router.get('/deadline-status', (req, res) => {
  const nowInfo = getNowInBusinessTimezone();
  const todayStr = nowInfo.dateStr;

  // Calculate yesterday in business timezone
  const yestObj = new Date(Date.UTC(nowInfo.year, nowInfo.month - 1, nowInfo.day));
  yestObj.setUTCDate(yestObj.getUTCDate() - 1);
  const yesterdayStr = yestObj.toISOString().split('T')[0];

  const todayStatus = checkActivityDeadline(todayStr);
  const yesterdayStatus = checkActivityDeadline(yesterdayStr);

  res.json({
    timezone: nowInfo.timezone,
    currentServerTime: nowInfo.isoLike,
    currentDate: nowInfo.dateStr,
    currentTime: nowInfo.timeStr,
    today: {
      date: todayStr,
      allowed: todayStatus.allowed,
      isLocked: todayStatus.isLocked,
      deadline: todayStatus.deadline,
      message: todayStatus.message
    },
    yesterday: {
      date: yesterdayStr,
      allowed: yesterdayStatus.allowed,
      isLocked: yesterdayStatus.isLocked,
      deadline: yesterdayStatus.deadline,
      message: yesterdayStatus.message
    }
  });
});

export default router;
