# How RideWind estimates your ride

RideWind works out when you'll reach each part of the route, then reads the forecast for that place at that hour. Timing comes from a fixed average speed or from a physics model that uses your power, the slope and the wind. Everything it shows is either a **forecast** straight from Open-Meteo or an **estimate** that RideWind calculated from it.

![How RideWind works, in five steps](how-it-works.svg)

The rest of this page explains each step, what RideWind assumes, and what it leaves out.

## Forecast or estimate?

Values marked **forecast** (solid dot) come straight from Open-Meteo. Values marked **estimate** (hollow dot) or **calculated** are RideWind's own maths.

## How the forecast is matched to your ride

- **Arrival times** come from your average speed or from the physics model below. Neither one allows for stops.
- **Forecast points:** RideWind picks up to 20 points spread evenly along the route, about 5 km apart. Each section of the map uses the nearest point's forecast, at the time you're expected to reach that section.
- **Between hours:** Open-Meteo gives one value per hour. For temperature and wind speed, RideWind blends the two hours either side of your arrival in a straight line. Wind direction is blended the short way round the compass, so 350° to 10° passes through 0°, not 180°. Rain, chance of rain and gusts are reported by Open-Meteo for the hour *before* each timestamp, so RideWind uses the hour your arrival falls in. If you'd arrive after the forecast ends, the section shows "No forecast" and RideWind doesn't guess.
- **Rain wording:** the summary leads with the highest chance of rain along the ride and gives the heaviest forecast rate as what to expect if it rains. Below a 20% chance it says *low chance of rain*, because a model can forecast a heavy rate at a low chance, and the rate alone would overstate the risk.
- **Splitting the wind:** wind direction is where the wind blows *from*. If you're heading in direction θ and the wind comes from φ:
  - headwind = speed × cos(φ − θ). Positive is a headwind, negative is a tailwind.
  - crosswind = speed × sin(φ − θ). Positive means the wind comes from your right.

  Your direction at each point is measured over 250 m either side, so GPS wobble doesn't flip it.
- **Naming the wind:** a headwind is within 45° of straight in your face, a tailwind within 45° of straight behind you, and anything else is a crosswind. Wind under 5 km/h counts as calm. These cut-offs are just how RideWind labels things on screen.
- **Wind height:** the forecast is for wind 10 m above the ground. It doesn't know about shelter from buildings, trees, hedges, cuttings or hills, and you'll usually feel less wind than this at road level.
- **Climbing:** small ups and downs under 3 m are ignored as GPS noise. If only some points have elevation, RideWind says so and uses the points that do.

## Physics model (power mode)

In power mode, RideWind finds the speed at which your power matches the forces slowing you down: air resistance, tyre friction, gravity on climbs, and a little friction in the wheel bearings and drivetrain. It uses the road cycling model from Martin, Milliken, Cobb, McFadden and Coggan (1998), "Validation of a mathematical model for road cycling power", *Journal of Applied Biomechanics* 14(3):276–291. For each step, RideWind finds the ground speed *v* at which your power at the pedals equals:

```
P = ( ½·ρ·CdA·v_air·|v_air|·v          aerodynamic drag, v_air = v + headwind
    + Crr·m·g·cos(atan G)·v             rolling resistance
    + m·g·sin(atan G)·v                 gravity
    + v·(91 + 8.7·v)·10⁻³ ) / η         wheel bearings; η = 0.976 drivetrain efficiency
```

`m` is rider plus bike mass, `g` = 9.80665 m/s² and `G` is the gradient. RideWind finds the speed by repeatedly halving the range it could be in (bisection).

- **Air density** (ρ) comes from the forecast temperature and the height above sea level. Warm air and high roads mean thinner air and less drag. Humidity is ignored.
- **Wind at rider height:** the 10 m forecast wind is scaled down to about 1.2 m, roughly where your body is, using v·(1.2/10)^α (the Hellmann power law). You pick how exposed the route is: open (α 0.14, about 74% of the forecast), mixed (α 0.25, about 59%) or sheltered (α 0.33, about 50%). Only the part of the wind along your direction of travel counts. The extra drag from wind hitting you side-on is ignored.
- **Steps:** RideWind moves along the route 100 m at a time. The slope is measured over 200 m centred on each step and capped at 25% up or down, so a bad elevation reading can't produce a wall. The clock moves forward step by step, so each step meets the forecast for when you'd actually get there.
- **Limits:** speed never goes above your **max descent speed**, on the assumption that you brake. On very steep climbs it never drops below 4 km/h, about walking pace.
- **Left out:** speeding up and slowing down, corners, traffic, stops, riding in a group, getting tired and changing your power. Where a step has no forecast, RideWind assumes still air and 15 °C and warns you.
- **No silent flat routes.** If the route has no elevation, or only some, power mode asks you to choose before showing results: look up elevation, or **Estimate as if flat**. A flat estimate is labelled "physics estimate, flat", the verdict says "(flat estimate)", and a warning is shown. In average-speed mode, the elevation chart says "No elevation data" instead of drawing a flat line.
- **Defaults:** 180 W, 75 kg rider, 9 kg bike and kit, CdA 0.32 m² (hands on the hoods), Crr 0.005 (everyday road tyres), 55 km/h max descent, mixed exposure. Change them to match you.

The tests check the model against sums worked out by hand for each force, check that working back from speed to power gives the same answer, and check that it reacts the right way to more power, wind, slope, drag, tyre friction and weight. A 200 W, 84 kg rider with CdA 0.32 and Crr 0.005 comes out at about 33 km/h on a calm, flat road.

## Comparing start times and directions

RideWind runs the same calculation for up to six start times (every 1, 2, 3 or 6 hours from the one you chose) in both directions. For each, it shows the ride time, the finish time (marked when it's after sunset or before sunrise), the share of the distance into a headwind and the highest chance of rain. It only lists options that finish before the forecast runs out. In power mode, **Best** is the quickest ride. In average-speed mode every ride takes the same time, so **Best** is the one with the least headwind. An option the forecast doesn't fully cover, or that starts before sunrise or finishes after sunset at the start point, is never marked Best. If the remaining options are within 5 minutes (power) or 3 km/h of average wind (average speed) of each other, none is marked and the table says there's no clear best.

All of this is a planning aid built on forecasts and a simplified model. It hasn't been checked against your own rides and isn't race advice. RideWind doesn't claim to match any commercial cycling weather service.
