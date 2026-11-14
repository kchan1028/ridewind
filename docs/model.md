# How RideWind estimates your ride

## Model assumptions

Values marked **forecast** (solid dot) come straight from Open-Meteo. Values marked **estimate** (hollow dot) or **calculated** are RideWind's own arithmetic.

- **Arrival times** come from either a constant average speed or the physics model below. Neither accounts for stops.
- **Sampling:** forecast points are spread evenly along the route, about 5 km apart, with at most 40. That keeps 5 km spacing on rides up to about 195 km. Each map section uses the nearest sample's forecast at that section's own estimated arrival time.
- **Matching to time:** temperature and wind speed are linearly interpolated between hourly values. Wind direction is interpolated along the shorter arc, so 350° to 10° passes through 0°. Precipitation, precipitation probability and gusts are totals or maximums for the *preceding* hour in Open-Meteo, so RideWind uses the hour that contains the arrival time. Arrivals outside the forecast window are shown as "No forecast" and are never filled in.
- **Wind components:** wind direction is where the wind blows *from*. With travel bearing θ and wind from φ:
  - headwind = speed × cos(φ − θ), where positive is a headwind and negative is a tailwind
  - crosswind = speed × sin(φ − θ), where positive means the wind comes from the right
  
  Travel bearing is measured over ±250 m around each point to smooth out GPS noise.
- **Classification:** headwind means within ±45° of straight on, tailwind within ±45° of directly behind, and crosswind anything in between. Wind below 5 km/h counts as calm. These cut-offs are a display convention.
- **Wind height:** the wind is the model's 10 m wind. It doesn't fully account for shelter from buildings, trees, hedges, cuttings or local terrain, and riders usually feel less wind than this at road level.
- **Elevation:** climbing and descending use a 3 m turning-point threshold to filter noise. If only some points have elevation, the app says so and calculates from the points that do.

## Physics model (power mode)

Speed comes from the steady-state road cycling model in Martin, Milliken, Cobb, McFadden and Coggan (1998), "Validation of a mathematical model for road cycling power", *Journal of Applied Biomechanics* 14(3):276–291. For each step, RideWind finds the ground speed *v* at which your power at the pedals equals:

```
P = ( ½·ρ·CdA·v_air·|v_air|·v          aerodynamic drag, v_air = v + headwind
    + Crr·m·g·cos(atan G)·v             rolling resistance
    + m·g·sin(atan G)·v                 gravity
    + v·(91 + 8.7·v)·10⁻³ ) / η         wheel bearings; η = 0.976 drivetrain efficiency
```

`m` is rider plus bike mass, `g` = 9.80665 m/s² and `G` is the gradient. The speed is found by bisection.

- **Air density** ρ comes from the forecast temperature and the elevation, using the standard atmosphere for pressure and the dry-air gas law. Humidity is ignored.
- **Wind at rider height:** the 10 m forecast wind is scaled to about 1.2 m with a Hellmann power law, v·(1.2/10)^α. You choose the exposure: open (α 0.14, about 74%), mixed (α 0.25, about 59%) or sheltered (α 0.33, about 50%). Only the component along your direction of travel is used. Crosswind effects on drag (yaw) are ignored.
- **Steps:** the route is walked in 100 m steps. Gradient is measured over a 200 m window centred on each step and clamped to ±25% to limit the effect of noisy elevation. The clock advances step by step, so each step meets the forecast for when you'd actually get there.
- **Limits:** speed is capped at your **max descent speed**, on the assumption that you brake. On very steep climbs it bottoms out at 4 km/h (walking pace).
- **Planned stops:** an optional total stop time, in minutes, works in both pace modes. It's spread evenly by distance, so halfway along you've used half of it. Later arrival times, the forecast they're matched to, and the finish time all move back. The average speed shown is moving speed, without the stops.
- **Not modelled:** acceleration and kinetic energy, corners, traffic, unplanned stops, drafting, fatigue and changes in power. Where a step has no forecast (outside the forecast window), still air and 15 °C are assumed, and the app warns you.
- **Missing elevation never silently becomes flat.** If the route has no elevation, or only some, power mode shows a choice instead of results: look up elevation, or **Estimate as if flat**. A flat estimate is labelled "physics estimate, flat", the verdict says "(flat estimate)", and a warning is shown. In constant-speed mode, the elevation chart says "No elevation data" instead of drawing a flat line.
- **Defaults:** 180 W, 75 kg rider, 9 kg bike and kit, CdA 0.32 m² (on the hoods), Crr 0.005, 55 km/h max descent, mixed exposure. Change them to match you.

The model's tests check it against hand calculations (aerodynamic, rolling, gravity and bearing terms), check that solving for speed exactly reverses the power calculation, and check that it responds the right way to power, wind, gradient, CdA, Crr and mass. A 200 W, 84 kg rider with CdA 0.32 and Crr 0.005 comes out at about 33 km/h on a calm flat road.

## How close are the estimates?

In November 2026 the power model was run against five of the maintainer's own recorded road rides, 73 to 141 km long. Each ride used the rider's weight plus a 9 kg bike, the default CdA, Crr, descent cap and mixed exposure, the real departure time, and Open-Meteo's archived forecast for that day. The prediction was compared with the ride's moving time.

| Ride | Distance | Climbing | Normalised power | Predicted | Actual moving time | Difference |
| --- | --- | --- | --- | --- | --- | --- |
| A | 72.6 km | 358 m | 172 W | 2 h 33 min | 2 h 52 min | −11.0% |
| B | 88.5 km | 564 m | 182 W | 2 h 58 min | 2 h 54 min | +1.9% |
| C | 141.4 km | 1,081 m | 170 W | 5 h 19 min | 5 h 24 min | −1.6% |
| D | 113.5 km | 1,247 m | 177 W | 4 h 25 min | 4 h 31 min | −2.5% |
| E | 86.0 km | 95 m | 190 W | 2 h 41 min | 3 h 00 min | −10.5% |

What this shows:

- **Which power figure you enter matters most.** With normalised power the model was 4.7% fast on average. With average power, which counts coasting as zero, it was 5.6% slow on average and up to 11% slow. A steady figure between the two is a reasonable starting point.
- **The worst misses were flat or stop-start rides** (A and E), where traffic, junctions and easy pedalling mean less steady effort than the power figure suggests.
- **Wind changed these predictions by 0 to 3%.** All five were loops, where headwind and tailwind largely cancel. The wind matters more on point-to-point rides and for choosing a direction.
- **Group rides need a lower CdA.** Three rides were in groups, where drafting cuts air drag below the default.

Five rides from one rider is a small check, not a validation. Expect errors of around 10% and adjust your power or CdA once you've compared a few of your own rides.

## Comparing departures and directions

For up to six departure times (every 1, 2, 3 or 6 hours from the one you chose) and both directions, RideWind runs the same simulation and reports ride time, the share of distance into a headwind, and the highest chance of rain. Only options that finish inside the forecast window are listed. **Best** means the shortest predicted time in power mode. In constant-speed mode, where every time is the same, it means the lowest average headwind. Options not fully covered by the forecast are never marked Best.

These are planning aids based on forecasts and a simplified model. They've only been checked against a few real rides and are not race advice. RideWind doesn't claim to match any commercial cycling weather service.
