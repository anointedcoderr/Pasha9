-- Built by Anointed Coder.
-- Read-only balance diagnostic.
--
-- Shows the most recent provider callbacks so we can compare, per callback:
--   typ = how the callback was classified (balance / bet / win / settle)
--   st  = whether the wallet pipeline accepted / rejected / duplicated it
--   bal = the wallet balance our database holds after the callback
--   ret = the credit_amount we handed back to the game (what it displays)
--   err = any rejection / gate error (blank means none)
--
-- If bal is correct but ret is 0, the fix is in how we build the response.
-- If bal itself is 0 or blank, the player is not resolving to their wallet.
-- If there are no rows with typ = balance, the getBalance polls are not
-- arriving (routing / whitelist), and err will usually say why.

\pset pager off

SELECT to_char("receivedAt", 'HH24:MI:SS')                AS t,
       response->'_diagnostics'->>'derivedType'           AS typ,
       response->'_diagnostics'->>'status'                AS st,
       response->'_diagnostics'->>'parsedBetAmount'       AS bet,
       response->'_diagnostics'->>'parsedWinAmount'       AS win,
       response->'_diagnostics'->>'walletAfter'           AS bal,
       response->>'credit_amount'                         AS ret,
       left(coalesce(error, ''), 32)                      AS err
FROM "ProviderCallbackLog"
ORDER BY "receivedAt" DESC
LIMIT 20;

-- Full body of the most recent balance-inquiry (getBalance) callback. This
-- shows the EXACT response fields we send back to the aggregator, so we can
-- confirm which fix is live and share the precise shape with the provider.
SELECT jsonb_pretty(response) AS latest_getbalance_response
FROM "ProviderCallbackLog"
WHERE response->'_diagnostics'->>'derivedType' = 'balance'
ORDER BY "receivedAt" DESC
LIMIT 1;
