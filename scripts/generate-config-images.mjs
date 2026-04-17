/**
 * generate-config-images.mjs
 *
 * Generates 4 DALL-E 3 images per car wash config (88 total):
 *   perspective, interior, aerial, spin (360°)
 *
 * Output: public/images/configs/{configId}/{view}.png
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/generate-config-images.mjs
 *
 * Options (env vars):
 *   QUALITY=standard|hd           (default: standard — $0.04/image)
 *   SIZE=1792x1024|1024x1024       (default: 1792x1024)
 *   ONLY=express-100,express-130   (comma-separated — only generate these configs)
 *   SKIP=express-100               (comma-separated — skip these configs)
 *   VIEW=perspective,aerial        (comma-separated — only generate these views)
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

// ── Config ─────────────────────────────────────────────────────────────────────

const QUALITY = process.env.QUALITY || "standard";
const SIZE    = process.env.SIZE    || "1792x1024";
const ONLY    = process.env.ONLY    ? process.env.ONLY.split(",").map(s => s.trim()) : null;
const SKIP    = process.env.SKIP    ? process.env.SKIP.split(",").map(s => s.trim()) : [];
const VIEWS   = process.env.VIEW    ? process.env.VIEW.split(",").map(s => s.trim()) : ["perspective", "interior", "aerial", "spin"];

const OUTPUT_DIR = path.resolve("public/images/configs");
const DELAY_MS   = 13_000; // ~4.6/min — safely under the 5/min DALL-E 3 limit

// ── Prompts ───────────────────────────────────────────────────────────────────
// 22 configs × 4 views = 88 prompts

const PROMPTS = {

  // ── CONVEYOR TUNNEL ─────────────────────────────────────────────────────────

  "express-100": {
    perspective: "Photorealistic exterior perspective shot of a compact 100-foot express car wash tunnel building, modern commercial architecture, bright branded entry arch with LED lighting, automated pay kiosks at the entrance, 6–8 vacuum stations visible at exit, suburban location, wide driveway approach, golden hour lighting, 8K ultra-detailed commercial photography",
    interior:    "Photorealistic interior view looking down the inside of a 100-foot car wash conveyor tunnel, high-pressure water jets spraying, colorful foam applicators on both sides, LED lighting strips along ceiling and walls, a car on the conveyor belt mid-wash, mist and foam visible, industrial equipment overhead, dramatic lighting, ultra-detailed",
    aerial:      "Aerial bird's-eye photorealistic view of a compact express car wash site, 100-foot tunnel building in the center, entry stacking lane on the left, exit vacuum stations on the right, parking lot, clearly visible car queue, overhead shot, crisp daylight, commercial real estate photography style",
    spin:        "Wide-angle 360 panoramic photorealistic ground-level view of a modern express car wash facility exterior, 100ft tunnel building visible, branded entrance arch, pay kiosks, clean asphalt forecourt, cars queuing, suburban commercial street backdrop, clear sky, golden hour, ultra-wide lens",
  },

  "express-130": {
    perspective: "Photorealistic exterior perspective of a standard 130-foot express car wash tunnel, modern commercial building, prominent branded entry arch with full-color LED lighting, 3 automated pay station kiosks at entry, 10 vacuum stations at exit, busy suburban arterial road location, daytime blue sky, sharp architectural photography",
    interior:    "Photorealistic interior photo looking through a 130-foot car wash conveyor tunnel, triple-foam color applicators on both sides, high-pressure rinse jets, cloth wrap curtains hanging, bright overhead LED tunnel lighting, a dark SUV on the conveyor mid-wash, steam and foam in the air, dramatic industrial lighting",
    aerial:      "Photorealistic aerial top-down view of a 130ft express car wash, longer tunnel building, dual stacking entry lanes, 10–12 vacuum stations clustered at exit, full parking lot visible, cars queuing, road frontage visible, crisp overhead commercial photography",
    spin:        "360 panoramic ground-level photorealistic view of a 130ft Tommy Car Wash style express tunnel, colorful branded arch, pay station kiosks, landscaped entry, clean forecourt, cars lined up, high-traffic commercial road backdrop, bright daylight",
  },

  "express-150": {
    perspective: "Photorealistic exterior perspective of a large 150-foot premium express car wash building, extended tunnel structure, multiple color foam application arches visible through the entry, 14 vacuum stations at exit, dual entry lane stacking, dramatic architectural photography, golden hour lighting, ultra-detailed",
    interior:    "Photorealistic interior of a 150-foot express car wash tunnel, multiple foam color arches — pink, blue, green — foam draping over a vehicle, extended high-velocity drying section at the far end with powerful blowers, bright LED strip lighting overhead, mist fills the air, cinematic shot",
    aerial:      "Aerial photorealistic overhead shot of a 150ft express car wash site, long tunnel building, dual stacking lanes at entry, 14–16 vacuum stations at exit, large parking area, landscaping around perimeter, high-traffic road visible, commercial photography, bright daylight",
    spin:        "Wide 360 panoramic photorealistic ground level view of a premium 150ft express car wash, extended building, multiple color foam arches visible through glass panels, large branded pylon sign, busy forecourt, cars at vacuums and entry, golden hour light",
  },

  "express-200": {
    perspective: "Photorealistic exterior of a flagship 200-foot high-volume express car wash tunnel, dominant large commercial building, triple entry stacking lanes, 18 vacuum stations clustered at exit, towering branded pylon sign, franchise flagship aesthetic, high-density arterial road location, dramatic wide-angle shot",
    interior:    "Photorealistic interior of a 200-foot car wash conveyor tunnel, long winding view down the tunnel, multiple foam arches, tyre-shine applicator strips on the floor, high-velocity dryers at far end, LED lights line the entire ceiling, two vehicles visible on the conveyor simultaneously, steam and foam throughout",
    aerial:      "Aerial bird's-eye photorealistic view of a large 200ft car wash facility, very long tunnel building dominates the lot, triple stacking entry lanes, 18–20 vacuum stations at exit, large asphalt lot, cars visible throughout, adjacent commercial street, high-resolution commercial real estate photography",
    spin:        "360 panoramic photorealistic ground-level exterior shot of a flagship 200ft express car wash, enormous building, triple entry lanes with pay kiosks, massive branded sign tower, cars queuing, high-density commercial street, cinematic golden hour lighting",
  },

  "touchless-conveyor": {
    perspective: "Photorealistic exterior of a touchless car wash conveyor tunnel, modern sleek minimalist building design, TOUCHLESS branding prominently displayed, subtle lighting strips, clean white and silver aesthetic, luxury Tesla and BMW vehicles at the entry, wide-angle exterior, golden hour",
    interior:    "Photorealistic interior of a touchless car wash tunnel, no brushes or cloth visible — only high-pressure water jet nozzles mounted on overhead gantries and side rails, intense water jets spraying from all angles onto a luxury car, water mist fills the air, bright sterile lighting, dramatic action shot",
    aerial:      "Aerial overhead photorealistic view of a touchless car wash site, tunnel building, clean minimalist exterior, luxury vehicles — Tesla, Porsche, BMW — in the queue and at vacuum stations, neat landscaping, crisp daylight, commercial photography",
    spin:        "Wide 360 panoramic photorealistic ground level shot of a touchless car wash facility, sleek modern building, NO BRUSHES ZERO CONTACT signage, Tesla and luxury car at entry, clean forecourt, suburban affluent location, soft daylight",
  },

  "soft-touch-conveyor": {
    perspective: "Photorealistic exterior perspective of a soft-touch friction conveyor car wash, standard tunnel building, cloth wrap advertising on the facade, family sedans and SUVs at the entry, automated pay kiosks, 10 vacuum stations at exit, busy suburban commercial location, daytime photography",
    interior:    "Photorealistic interior of a soft-touch friction car wash tunnel, hanging cloth wrap curtains touching a sedan as it moves through on the conveyor, foam brushes rotating on both sides, high-pressure pre-rinse jets at entry, soap suds everywhere, colorful foam applicators, dramatic wet industrial lighting",
    aerial:      "Aerial photorealistic top-down view of a soft-touch conveyor tunnel car wash, standard sized building, entry stacking lane, vacuum cluster at exit, everyday vehicles — Honda, Toyota, Hyundai — visible on the site, suburban street fronting, bright overhead daylight",
    spin:        "360 panoramic photorealistic exterior ground view of a soft-touch car wash, conveyor tunnel building, cloth wrap imagery on signage, vehicles at pay stations and vacuums, busy suburban commercial road, golden hour, wide-angle",
  },

  "hybrid-conveyor": {
    perspective: "Photorealistic exterior of a premium hybrid car wash tunnel combining touchless and soft-touch technology, 150-foot building, dual-technology branding on facade showing HIGH PRESSURE and SOFT TOUCH zones, premium vehicles at entry, dramatic architectural lighting, dusk setting",
    interior:    "Photorealistic interior split-view of a hybrid car wash tunnel — the first half shows high-pressure water jets only (touchless section), the second half shows soft cloth wraps and foam brushes (friction section), a car transitioning between zones, different lighting tones in each section, dramatic cinematic shot",
    aerial:      "Aerial photorealistic overhead view of a 150ft hybrid car wash site, longer tunnel building, dual technology signage visible on roof, premium vehicles in queue, dual stacking lanes at entry, vacuum stations at exit, upscale commercial location, crisp daylight",
    spin:        "Wide 360 panoramic photorealistic ground level view of a hybrid dual-technology car wash, premium building design, TOUCHLESS PLUS SOFT TOUCH branding, luxury and mainstream vehicles queuing, clean forecourt, suburban premium commercial location, golden hour",
  },

  "flex-serve": {
    perspective: "Photorealistic exterior perspective of a flex-serve car wash facility, 130ft conveyor tunnel on one side, 4–6 glass-fronted interior finishing bays visible on the other side, staff in uniform attending to cars in finish bays, separate signage for EXPRESS and FULL SERVICE lanes, suburban location, daytime",
    interior:    "Photorealistic interior view of a flex-serve car wash finishing bay, staff member vacuuming the interior of a car, another wiping windows, bright overhead industrial lighting, clean organized interior bay, branded uniforms, floor drains visible, professional service atmosphere",
    aerial:      "Aerial photorealistic top-down view of a flex-serve car wash site, conveyor tunnel building on one side, row of 4–6 indoor service bays alongside it, cars parked and being serviced, cars queuing for tunnel, dual driveway flow visible, large lot, daylight",
    spin:        "360 panoramic photorealistic exterior of a flex-serve car wash, tunnel entry on the left, finishing bay entrance on the right, signage for both service tiers, cars going to both areas, staff visible, daytime commercial photography",
  },

  "full-service": {
    perspective: "Photorealistic exterior of a premium full-service car wash, upscale building design, landscaped entry with decorative lighting, customer lounge with large windows, staff in matching uniforms attending to cars in finish bays, luxury vehicles, elegant pylon signage, early evening dramatic lighting",
    interior:    "Photorealistic interior of a full-service car wash finish area, multiple staff towel-drying and vacuuming a luxury car, premium customer lounge visible through glass, clean bright space, shelves of detailing products, professional atmosphere, branded staff uniforms, warm interior lighting",
    aerial:      "Aerial photorealistic top-down view of a full-service car wash, large lot, conveyor tunnel, extensive finishing bay building, customer lounge wing, multiple staff working on cars simultaneously, upscale suburban location, ample parking, manicured landscaping visible",
    spin:        "360 panoramic photorealistic ground-level exterior of a premium full-service car wash, elegant building facade, landscaped driveway, concierge-style entry, luxury vehicles being escorted in by uniformed staff, customer lounge windows visible, warm golden hour lighting",
  },

  // ── IN-BAY AUTOMATIC ────────────────────────────────────────────────────────

  "inbay-touchless": {
    perspective: "Photorealistic exterior perspective of a single touchless in-bay automatic car wash, small compact building, one drive-through bay opening, pay terminal at the entrance, TOUCHLESS signage, gas station or retail strip mall adjacent, compact lot, daytime commercial photography",
    interior:    "Photorealistic interior view inside a touchless in-bay automatic car wash bay, high-pressure water jet gantry arching over a stationary sedan, multiple nozzle heads spraying intense jets from overhead and sides, water mist fills the enclosed bay, bright overhead lighting, no brushes visible anywhere, dramatic action shot",
    aerial:      "Aerial photorealistic top-down view of a compact single in-bay automatic car wash, small standalone building, single bay opening, short driveway queue, pay terminal visible, integrated into a gas station forecourt, neat compact site, crisp daylight",
    spin:        "360 panoramic photorealistic exterior view of a single touchless in-bay car wash, small building, car entering the bay, pay terminal beside entry, TOUCHLESS WASH signage, gas station canopy in background, daylight, wide-angle",
  },

  "inbay-soft-touch": {
    perspective: "Photorealistic exterior of a single soft-touch in-bay automatic car wash, compact standalone building, rotating brush gantry visible through the open bay, SOFT TOUCH AUTO WASH signage, pay terminal at entry, small suburban or gas station location, daytime",
    interior:    "Photorealistic interior of a soft-touch in-bay car wash, rotating cloth brush gantry wrapping around a stationary car, foam soap visible, gantry moving across the vehicle, enclosed bay with drainage floor, bright fluorescent lighting, soap suds on windows, action shot",
    aerial:      "Aerial photorealistic overhead view of a single in-bay automatic soft-touch car wash, compact building footprint, single drive-through lane, pay terminal, integrated into a retail parking lot or gas station, neat small site, overhead daylight",
    spin:        "360 panoramic photorealistic ground exterior view of a single soft-touch in-bay car wash, small clean building, brush gantry visible through the opening, pay terminal, suburban setting, wide-angle daylight shot",
  },

  "inbay-dual": {
    perspective: "Photorealistic exterior of a dual in-bay automatic car wash, building with two side-by-side drive-through bay openings, two pay terminals at entry, cars in both bays simultaneously, compact mid-size lot, standalone commercial building, daytime",
    interior:    "Photorealistic interior showing both bays of a dual in-bay car wash, one touchless gantry in action with water jets on the left, one soft-touch gantry with brushes on the right, two cars being washed simultaneously, bright overhead lighting, dramatic industrial shot",
    aerial:      "Aerial top-down photorealistic view of a dual in-bay automatic car wash site, building with two clearly visible bay openings side by side, two entry lanes, shared vacuum island cluster in the exit area, medium-sized lot, commercial street frontage, crisp daylight",
    spin:        "360 panoramic photorealistic exterior of a dual in-bay car wash, building with two bay openings, two pay kiosk terminals, car exiting one bay while another enters, vacuum stations to the right, suburban commercial location, wide-angle shot",
  },

  "inbay-triple": {
    perspective: "Photorealistic exterior perspective of a triple in-bay automatic car wash, long building with three side-by-side drive-through bay openings, three pay terminals at entry, all three bays occupied simultaneously, medium-sized commercial lot, strong branding on facade, daytime",
    interior:    "Photorealistic interior of a triple in-bay car wash, view through three open bays simultaneously, gantries in various stages of operation across all three bays, water jets and brushes in action, three vehicles visible, overhead industrial lighting, busy operational shot",
    aerial:      "Aerial photorealistic top-down view of a triple in-bay automatic car wash site, long building with three bays clearly visible, three entry lanes, shared vacuum cluster at exit, commercial road frontage, overhead daylight photography",
    spin:        "Wide 360 panoramic photorealistic exterior of a triple in-bay car wash, long building facade with three bay openings, three pay terminals, cars queuing at two lanes, vacuum area visible to the side, suburban commercial location, golden hour",
  },

  // ── SELF-SERVE ──────────────────────────────────────────────────────────────

  "self-serve-4": {
    perspective: "Photorealistic exterior perspective of a 4-bay self-serve car wash, open-air canopy roof over four individual drive-through wash bays, coin and card pay terminals visible in each bay, pressure wand hanging in each stall, compact rural or small-town commercial location, clear daylight",
    interior:    "Photorealistic interior of a self-serve car wash bay, customer using a high-pressure wand to spray their truck, foam brush option hanging on the wall, coin box on the wall, open-sided bay with corrugated roof, water spray action, overhead fluorescent lighting, industrial setting",
    aerial:      "Aerial photorealistic top-down view of a 4-bay self-serve car wash, open canopy structure with four clearly defined drive-through bays, cars in two of the bays, small parking area adjacent, vacuum stations visible, compact lot, rural or suburban setting, daylight",
    spin:        "360 panoramic photorealistic exterior of a 4-bay self-serve car wash, open canopy structure, four wash bays visible end-on, coin terminals at each, customer washing a pickup truck in one bay, rural or small-town backdrop, wide-angle daylight",
  },

  "self-serve-6": {
    perspective: "Photorealistic exterior of a 6-bay self-serve car wash, longer open-air canopy structure covering six individual drive-through bays, coin-card terminals, pressure wands, several bays occupied, one truck visible, rural or suburban commercial location, daytime",
    interior:    "Photorealistic interior bay of a 6-bay self-serve car wash, truck owner using high-pressure wand to rinse mud off a 4x4, foam brush available on wall, coin meter on post, open-sided corrugated canopy, concrete floor with drainage, overcast daylight",
    aerial:      "Aerial photorealistic overhead view of a 6-bay self-serve car wash, long canopy building covering six bays, cars and trucks in multiple bays, vacuum island to the side, linear lot layout, rural or suburban road frontage visible, daylight",
    spin:        "360 panoramic photorealistic exterior of a 6-bay self-serve car wash, long canopy structure viewed from the end showing all 6 bays, trucks and cars visible inside bays, coin terminals, vacuum area on the side, agricultural or suburban setting, golden hour",
  },

  "self-serve-8": {
    perspective: "Photorealistic exterior of a large 8-bay self-serve car wash, extended open-air canopy covering eight drive-through bays, truck and RV in oversized end bays, vacuum island cluster visible, vending machines by the entrance, rural or agricultural commercial location, daytime",
    interior:    "Photorealistic interior of a large self-serve car wash, farmer washing a muddy pickup truck in a wide RV-sized bay, pressure wand in use, foam applicator on the wall, open-sided corrugated roof, natural light filtering in, agricultural community setting",
    aerial:      "Aerial photorealistic top-down view of an 8-bay self-serve car wash, very long canopy structure over 8 bays, trucks and vehicles in multiple bays, large vacuum island cluster at one end, vending area, large lot, agricultural road visible, crisp overhead daylight",
    spin:        "360 panoramic photorealistic exterior of an 8-bay self-serve car wash, very long canopy viewed from the approach, multiple bays occupied, oversized truck bays at the far end, vacuum cluster area, agricultural landscape backdrop, wide-angle shot",
  },

  // ── COMBINATION ─────────────────────────────────────────────────────────────

  "tunnel-selfserve-combo": {
    perspective: "Photorealistic exterior perspective of a combination car wash site, a 130ft express conveyor tunnel building on one side and a 4–6 bay self-serve canopy on the other side, shared vacuum stations in the middle, two separate entry lanes clearly marked, large commercial lot, daylight",
    interior:    "Photorealistic dual-scene interior, left side shows inside the 130ft express tunnel with foam and conveyor in action, right side shows a customer using a self-serve bay pressure wand, both on the same site, industrial lighting, commercial wash facility atmosphere",
    aerial:      "Aerial photorealistic top-down view of a combination express tunnel plus self-serve car wash site, long tunnel building on one side, row of self-serve bays on the other, shared vacuum island in the center, two entry lanes, cars in both areas, large commercial lot, crisp overhead daylight",
    spin:        "360 panoramic photorealistic ground-level exterior of a combination tunnel and self-serve site, tunnel entry arch on the left, self-serve canopy visible on the right, EXPRESS TUNNEL and SELF-SERVE BAYS signs, cars in both areas, large commercial lot, golden hour",
  },

  "inbay-selfserve-combo": {
    perspective: "Photorealistic exterior perspective of a combination in-bay automatic plus self-serve car wash, building with 2 in-bay automatic bay openings on one end, 4–6 self-serve bays under a canopy on the other, shared vacuum area in the middle, medium lot, daytime commercial photography",
    interior:    "Photorealistic dual view, in-bay automatic gantry washing a car on the left, customer using a self-serve pressure wand in a bay on the right, both operating on the same site, different environments in each area, shared forecourt visible",
    aerial:      "Aerial photorealistic top-down view of an in-bay plus self-serve combo site, in-bay automatic building with 2 bay openings clearly visible, self-serve canopy with 4–6 bays alongside, shared vacuum island, medium-sized lot, commercial road frontage, daylight",
    spin:        "360 panoramic photorealistic exterior of an in-bay plus self-serve combination site, in-bay bay openings with pay terminals on the left, self-serve canopy on the right, shared lot, AUTOMATIC WASH and SELF-SERVE signs, suburban commercial road, wide-angle daylight",
  },

  "tunnel-detail-combo": {
    perspective: "Photorealistic exterior perspective of a premium tunnel plus detailing centre combination, 130ft express tunnel building on one side, upscale enclosed detailing centre with large glass windows alongside, luxury vehicles being worked on inside visible through glass, premium branding, affluent suburban location, golden hour",
    interior:    "Photorealistic interior of a professional car detailing centre, technician applying ceramic coating to a Ferrari, bright clean industrial space, detail bays with drainage, product shelves on wall, branded uniforms, another car visible in background, professional atmosphere",
    aerial:      "Aerial photorealistic top-down view of a tunnel plus detail centre combo site, express tunnel building on one side, detail centre building alongside, luxury vehicles parked outside, separate entry for detail centre, large lot, upscale commercial area, crisp daylight",
    spin:        "360 panoramic exterior of a combination express car wash and detail centre, express tunnel with branded arch on the left, glass-fronted detailing building on the right, luxury vehicles in the lot, high-end branding throughout, affluent suburban commercial setting, golden hour",
  },

  // ── SPECIALISED ─────────────────────────────────────────────────────────────

  "hand-wash": {
    perspective: "Photorealistic exterior perspective of a hand wash and full detail centre, urban commercial building, open wash bays visible at the front, trained staff in uniform hand-washing luxury cars, buckets and pressure hoses, dense urban city setting, customers waiting, daytime",
    interior:    "Photorealistic interior of a hand wash detail bay, trained staff using microfibre towels to hand-dry a luxury car, another person hand-polishing the hood, clean professional space, product shelves, branded uniforms, warm overhead lighting, premium service atmosphere",
    aerial:      "Aerial photorealistic top-down view of an urban hand wash and detail centre, compact city lot, multiple cars being hand washed by staff simultaneously, customers waiting, staff in uniforms visible from above, urban street frontage, dense commercial area, crisp daylight",
    spin:        "360 panoramic photorealistic exterior of an urban hand wash centre, staff hand-washing cars in open bays, customers watching or waiting, compact city lot, urban street backdrop, buildings around, signage for hand wash services, busy daytime atmosphere, wide-angle",
  },

  "ev-express": {
    perspective: "Photorealistic exterior perspective of an EV-optimised express car wash, 130ft tunnel building, EV charging stations integrated into the vacuum station canopy, Level 2 and DC fast chargers visible, Tesla Rivian and Lucid vehicles plugged in, green and blue EV branding, modern architectural design, golden hour",
    interior:    "Photorealistic interior of an EV-safe car wash tunnel, no undercarriage spray in the lower section, overhead and side wash equipment only, a Tesla Model 3 on the conveyor mid-wash, blue LED tunnel lighting with green EV accent lights, clean futuristic aesthetic, mist in the air",
    aerial:      "Aerial photorealistic top-down view of an EV-optimised car wash site, express tunnel building, large covered canopy at exit with Level 2 EV chargers at every vacuum station, DC fast charger pods at the perimeter, Tesla and EV vehicles visible throughout, modern commercial site, crisp daylight",
    spin:        "360 panoramic photorealistic ground-level exterior of an EV car wash, express tunnel with green EV branding, EV charging canopy with cars plugged in, WASH AND CHARGE signage, Tesla and Rivian in the lot, modern clean architecture, tech-forward suburban location, golden hour",
  },

  "mobile-container": {
    perspective: "Photorealistic exterior perspective of a container-based mobile car wash, converted shipping container with professional car wash branding, one in-bay automatic unit inside, temporary site in a retail car park, portable pay terminal outside, temporary signage, daylight",
    interior:    "Photorealistic interior of a mobile container car wash, compact in-bay automatic gantry washing a car inside a converted shipping container, industrial interior with bright lighting, water drainage system on the floor, minimal equipment, tight functional space",
    aerial:      "Aerial photorealistic top-down view of a mobile container car wash in a supermarket or retail car park, one shipping container converted into a wash bay, cars queuing in the car park, temporary signage, minimal footprint, surrounded by regular car park, daylight",
    spin:        "360 panoramic photorealistic exterior of a mobile container car wash, converted blue shipping container with branding, car entering the bay, retail shopping centre car park surrounding it, temporary setup appearance, wide-angle daylight shot",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, response => {
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function pad(n, total) {
  return String(n).padStart(String(total).length, "0");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌  OPENAI_API_KEY is not set. Run:\n   OPENAI_API_KEY=sk-... node scripts/generate-config-images.mjs");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  // Build task list
  let configIds = Object.keys(PROMPTS);
  if (ONLY) configIds = configIds.filter(id => ONLY.includes(id));
  configIds = configIds.filter(id => !SKIP.includes(id));

  const tasks = [];
  for (const configId of configIds) {
    for (const view of VIEWS) {
      const prompt = PROMPTS[configId]?.[view];
      if (!prompt) continue;
      const outDir  = path.join(OUTPUT_DIR, configId);
      const outFile = path.join(outDir, `${view}.png`);
      // Skip if already exists
      if (fs.existsSync(outFile)) {
        console.log(`⏭️   Skip (exists): ${configId}/${view}`);
        continue;
      }
      tasks.push({ configId, view, prompt, outDir, outFile });
    }
  }

  const total = tasks.length;
  if (total === 0) {
    console.log("✅  All images already exist. Nothing to generate.");
    return;
  }

  const costPerImage = QUALITY === "hd" ? 0.08 : 0.04;
  const estimatedCost = (total * costPerImage).toFixed(2);

  console.log(`\n🎨  Car Wash Config Image Generator`);
  console.log(`   Quality : ${QUALITY}`);
  console.log(`   Size    : ${SIZE}`);
  console.log(`   Images  : ${total}`);
  console.log(`   Est cost: ~$${estimatedCost} USD`);
  console.log(`   Output  : ${OUTPUT_DIR}\n`);

  let done = 0;
  let failed = 0;

  for (const { configId, view, prompt, outDir, outFile } of tasks) {
    done++;
    console.log(`[${pad(done, total)}/${total}] Generating ${configId}/${view}...`);

    // Ensure output directory exists
    fs.mkdirSync(outDir, { recursive: true });

    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      try {
        const response = await openai.images.generate({
          model:   "dall-e-3",
          prompt,
          n:       1,
          size:    SIZE,
          quality: QUALITY,
          response_format: "url",
        });

        const imageUrl = response.data[0].url;
        await downloadFile(imageUrl, outFile);
        console.log(`   ✅  Saved → ${path.relative(process.cwd(), outFile)}`);
        break;

      } catch (err) {
        const isRateLimit = err?.status === 429 || err?.message?.includes("rate");
        if (isRateLimit && attempts < MAX_ATTEMPTS) {
          const wait = DELAY_MS * attempts;
          console.log(`   ⏳  Rate limited — waiting ${wait / 1000}s before retry ${attempts}/${MAX_ATTEMPTS}...`);
          await sleep(wait);
        } else {
          console.error(`   ❌  Failed after ${attempts} attempt(s): ${err.message}`);
          failed++;
          break;
        }
      }
    }

    // Polite delay between requests (skip after last task)
    if (done < total) {
      process.stdout.write(`   ⏳  Waiting ${DELAY_MS / 1000}s...\r`);
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n🏁  Done. ${done - failed}/${total} images generated successfully.`);
  if (failed > 0) {
    console.log(`   ⚠️   ${failed} image(s) failed — re-run the script to retry (existing files are skipped).`);
  }
  console.log(`\n📁  Images saved to: ${OUTPUT_DIR}`);
  console.log(`\nNext step: run the wiring script to add image paths to carwashConfigs.ts`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
