# Wander Wise

Build an AI-powered Smart Travel Planner web application, end to end.

Specification:
The app creates personalized itineraries from destination, budget, travel dates, number of travelers, and interests. It shows places to visit, hotels, restaurants, an interactive map, weather, estimated expenses, and a packing list. Users can save, share, and modify trips using AI.

Requirements:
1. Trip input form with validation: destination autocomplete, date range, number of travelers (adults/children), budget + currency, interest chips, pace (relaxed/balanced/packed), special requirements.
2. Structured planner engine: realistic places (attractions, restaurants, hotels) with verified ratings, opening hours, and costs, weather per day (forecast vs. climate averages), balanced daily schedule (3-5 activities, geographic clustering to minimize transit time, meal breaks), and deterministic budget calculation with category breakdown and overage warnings.
3. Day-by-day itinerary view with interactive map showing route pins and day polylines.
4. "Modify with AI": prompt bar to patch existing itineraries (e.g. "swap lunch for vegetarian ramen", "make day 2 more relaxed") with version history and undo.
5. Packing list organized by category (clothing, documents, electronics, health, misc).
6. Save and share trips via unguessable read-only link with a "copy to my trips" button.
7. Export to PDF (print stylesheet) and calendar .ics download.
8. Clean, responsive, mobile-first design with smooth loading states and skeletons.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3d0e624d-9293-464b-b197-54183256f379).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
