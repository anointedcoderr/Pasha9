// Built by Anointed Coder.
//
// M2I client-side pixel injector. Mounts in the root layout. Fetches
// /api/content/tracking once on the first client paint and injects
// the standard pixel snippets for every platform with a configured
// id. Safe to render multiple times - each platform check skips if
// the global is already initialised.
//
// Loads the official snippets verbatim from the platforms' docs:
//   Facebook  fbq + base pixel
//   TikTok    ttq base + identify/page
//   GA4       gtag.js with measurement id
//   Google Ads gtag.js conversion id (same gtag init as GA4 when both set)

'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

interface TrackingIds {
  facebook: string | null;
  tiktok: string | null;
  ga4: string | null;
  googleAds: string | null;
  googleAdsConversionLabel: string | null;
  gtm: string | null;
}

export function TrackingScripts() {
  const [ids, setIds] = useState<TrackingIds | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/tracking', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setIds(data as TrackingIds);
      })
      .catch(() => { /* tracking is best-effort; never fail the page */ });
    return () => { alive = false; };
  }, []);

  if (!ids) return null;

  const gtagId = ids.ga4 || ids.googleAds;

  return (
    <>
      {ids.facebook ? (
        <Script id="pasha9-fb-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s){
              if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)
            }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${ids.facebook}');
            fbq('track', 'PageView');
          `}
        </Script>
      ) : null}

      {ids.tiktok ? (
        <Script id="pasha9-tt-pixel" strategy="afterInteractive">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
              ttq.load('${ids.tiktok}');
              ttq.page();
            }(window, document, 'ttq');
          `}
        </Script>
      ) : null}

      {gtagId ? (
        <>
          <Script
            id="pasha9-gtag-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gtagId)}`}
          />
          <Script id="pasha9-gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              ${ids.ga4 ? `gtag('config', '${ids.ga4}');` : ''}
              ${ids.googleAds ? `gtag('config', '${ids.googleAds}');` : ''}
            `}
          </Script>
        </>
      ) : null}

      {ids.gtm ? (
        <Script id="pasha9-gtm" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${ids.gtm}');
          `}
        </Script>
      ) : null}
    </>
  );
}
