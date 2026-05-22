-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'blocked', 'pending');

-- CreateEnum
CREATE TYPE "Lang" AS ENUM ('bn', 'en');

-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('deposit', 'withdraw', 'bonus', 'referral', 'bet', 'win', 'adjust');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "BonusType" AS ENUM ('first_deposit', 'daily', 'weekly', 'referral', 'vip', 'invite', 'reload', 'manual', 'promo');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('active', 'hidden', 'paused');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('active', 'maintenance');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('active', 'maintenance');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'pending', 'closed');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('signup', 'login', 'reset', 'verify_phone');

-- CreateEnum
CREATE TYPE "SettingCategory" AS ENUM ('general', 'branding', 'security', 'sms', 'payment', 'apk', 'tracking', 'content', 'referral');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordChangedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "roleId" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "country" TEXT NOT NULL DEFAULT 'BD',
    "language" "Lang" NOT NULL DEFAULT 'bn',
    "referralCode" TEXT NOT NULL,
    "referredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bonusBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lockedBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TxType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "TxStatus" NOT NULL DEFAULT 'completed',
    "reference" TEXT,
    "description" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "proofUrl" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonusRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BonusType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "minDeposit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "maxBonus" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'active',
    "description" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "turnoverX" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonusRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBonus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bonusRuleId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UserBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "titleEn" TEXT,
    "subtitleEn" TEXT,
    "imageUrl" TEXT,
    "link" TEXT,
    "ctaLabel" TEXT,
    "accent" TEXT NOT NULL DEFAULT 'gold',
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopupAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "status" "ContentStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PopupAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoText" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomepageContent" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "titleBn" TEXT,
    "titleEn" TEXT,
    "bodyBn" TEXT,
    "bodyEn" TEXT,
    "imageUrl" TEXT,
    "link" TEXT,
    "meta" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiBase" TEXT,
    "apiKey" TEXT,
    "status" "ProviderStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "categoryId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "launchUrl" TEXT,
    "accent" TEXT NOT NULL DEFAULT 'gold',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "GameStatus" NOT NULL DEFAULT 'active',
    "minBet" DECIMAL(14,2) NOT NULL DEFAULT 10,
    "maxBet" DECIMAL(14,2) NOT NULL DEFAULT 5000,
    "houseEdge" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "rtpTarget" DECIMAL(5,2) NOT NULL DEFAULT 95,
    "riskLevel" TEXT NOT NULL DEFAULT 'medium',
    "wagerContrib" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "bonusEligible" BOOLEAN NOT NULL DEFAULT true,
    "payoutTable" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralLink" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "status" "ContentStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralBonus" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "category" "SettingCategory" NOT NULL DEFAULT 'general',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'mobile',
    "status" "ContentStatus" NOT NULL DEFAULT 'active',
    "number" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "OtpCode_phone_purpose_idx" ON "OtpCode"("phone", "purpose");

-- CreateIndex
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Deposit_status_idx" ON "Deposit"("status");

-- CreateIndex
CREATE INDEX "Deposit_userId_idx" ON "Deposit"("userId");

-- CreateIndex
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");

-- CreateIndex
CREATE INDEX "Withdrawal_userId_idx" ON "Withdrawal"("userId");

-- CreateIndex
CREATE INDEX "UserBonus_userId_idx" ON "UserBonus"("userId");

-- CreateIndex
CREATE INDEX "Banner_status_position_idx" ON "Banner"("status", "position");

-- CreateIndex
CREATE INDEX "PopupAnnouncement_status_idx" ON "PopupAnnouncement"("status");

-- CreateIndex
CREATE INDEX "PromoText_status_position_idx" ON "PromoText"("status", "position");

-- CreateIndex
CREATE UNIQUE INDEX "HomepageContent_section_key" ON "HomepageContent"("section");

-- CreateIndex
CREATE UNIQUE INDEX "GameCategory_slug_key" ON "GameCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GameProvider_name_key" ON "GameProvider"("name");

-- CreateIndex
CREATE INDEX "Game_categoryId_idx" ON "Game"("categoryId");

-- CreateIndex
CREATE INDEX "Game_providerId_idx" ON "Game"("providerId");

-- CreateIndex
CREATE INDEX "Game_status_idx" ON "Game"("status");

-- CreateIndex
CREATE INDEX "ReferralLink_referrerId_idx" ON "ReferralLink"("referrerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralLink_referrerId_referredUserId_key" ON "ReferralLink"("referrerId", "referredUserId");

-- CreateIndex
CREATE INDEX "ReferralBonus_referrerId_idx" ON "ReferralBonus"("referrerId");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");

-- CreateIndex
CREATE INDEX "PaymentMethod_status_position_idx" ON "PaymentMethod"("status", "position");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBonus" ADD CONSTRAINT "UserBonus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBonus" ADD CONSTRAINT "UserBonus_bonusRuleId_fkey" FOREIGN KEY ("bonusRuleId") REFERENCES "BonusRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GameCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "GameProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

