/**
 * Email template helpers for StellarAid notifications.
 * Each function returns an object with `subject` and `html` builder.
 */

interface DonationReceivedData {
  donorName: string;
  amount: string;
  assetCode: string;
  campaignTitle: string;
  campaignUrl: string;
}

interface MilestoneUnlockedData {
  campaignTitle: string;
  milestoneTitle: string;
  campaignUrl: string;
}

interface CampaignUpdateData {
  campaignTitle: string;
  updateTitle: string;
  updateContent: string;
  campaignUrl: string;
}

export const donationReceivedTemplate = {
  subject: 'New Donation Received! 💰',
  html: (data: DonationReceivedData) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="color:#10b981;font-size:28px;margin:0">🎉 New Donation!</h1>
  </div>
  <p style="font-size:16px;line-height:1.6">
    <strong>${data.donorName}</strong> just donated <strong style="color:#10b981">${data.amount} ${data.assetCode}</strong>
    to your campaign <strong>"${data.campaignTitle}"</strong>!
  </p>
  <div style="text-align:center;margin:32px 0">
    <a href="${data.campaignUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:16px">
      View Campaign
    </a>
  </div>
  <p style="font-size:14px;color:#888;line-height:1.5">
    Every contribution brings you closer to your goal. Keep up the great work!
  </p>
</body>
</html>`,
};

export const milestoneUnlockedTemplate = {
  subject: 'Milestone Unlocked! 🏆',
  html: (data: MilestoneUnlockedData) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="color:#f59e0b;font-size:28px;margin:0">🏆 Milestone Reached!</h1>
  </div>
  <p style="font-size:16px;line-height:1.6">
    Congratulations! The milestone <strong>"${data.milestoneTitle}"</strong> for your campaign
    <strong>"${data.campaignTitle}"</strong> has been unlocked!
  </p>
  <div style="text-align:center;margin:32px 0">
    <a href="${data.campaignUrl}" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:16px">
      View Progress
    </a>
  </div>
  <p style="font-size:14px;color:#888;line-height:1.5">
    Keep pushing forward — your community believes in this mission!
  </p>
</body>
</html>`,
};

export const campaignUpdateTemplate = {
  subject: 'Campaign Update 📢',
  html: (data: CampaignUpdateData) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="color:#3b82f6;font-size:28px;margin:0">📢 New Update</h1>
  </div>
  <p style="font-size:16px;line-height:1.6">
    <strong>"${data.campaignTitle}"</strong> has posted a new update:
  </p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:16px 0">
    <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">${data.updateTitle}</h2>
    <p style="font-size:14px;line-height:1.6;color:#475569;margin:0">${data.updateContent}</p>
  </div>
  <div style="text-align:center;margin:24px 0">
    <a href="${data.campaignUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:16px">
      View Update
    </a>
  </div>
</body>
</html>`,
};
