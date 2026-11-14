# How RideWind estimates your ride

## Model assumptions

Values marked **forecast** (solid dot) come straight from Open-Meteo. Values marked **estimate** (hollow dot) or **calculated** are RideWind's own arithmetic.

- **Arrival times** come from either a constant average speed or the physics model below. Neither accounts for stops.
- **Sampling:** forecast points are spread evenly along the route, about 5 km apart, with at most 20. Each map section uses the nearest sample's forecast at that section's own estimated arrival time.
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
- **Not modelled:** acceleration and kinetic energy, corners, traffic, stops, drafting, fatigue and changes in power. Where a step has no forecast (outside the forecast window), still air and 15 °C are assumed, and the app warns you.
- **Missing elevation never silently becomes flat.** If the route has no elevation, or only some, power mode shows a choice instead of results: look up elevation, or **Estimate as if flat**. A flat estimate is labelled "physics estimate, flat", the verdict says "(flat estimate)", and a warning is shown. In constant-speed mode, the elevation chart says "No elevation data" instead of drawing a flat line.
- **Defaults:** 180 W, 75 kg rider, 9 kg bike and kit, CdA 0.32 m² (on the hoods), Crr 0.005, 55 km/h max descent, mixed exposure. Change them to match you.

The model's tests check it against hand calculations (aerodynamic, rolling, gravity and bearing terms), check that solving for speed exactly reverses the power calculation, and check that it responds the right way to power, wind, gradient, CdA, Crr and mass. A 200 W, 84 kg rider with CdA 0.32 and Crr 0.005 comes out at about 33 km/h on a calm flat road.

## Comparing departures and directions

For up to six departure times (every 1, 2, 3 or 6 hours from the one you chose) and both directions, RideWind runs the same simulation and reports ride time, the share of distance into a headwind, and the highest chance of rain. Only options that finish inside the forecast window are listed. **Best** means the shortest predicted time in power mode. In constant-speed mode, where every time is the same, it means the lowest average headwind. Options not fully covered by the forecast are never marked Best.

These are planning aids based on forecasts and a simplified model. They are not validated against your own rides and are not race advice. RideWind doesn't claim to match any commercial cycling weather service.
