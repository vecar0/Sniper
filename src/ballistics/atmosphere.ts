/** 대기 모델 (ICAO 표준대기 근사). 고도가 높고 기온이 높을수록 공기가 희박해져 탄이 덜 감속한다. */

export const SEA_LEVEL_DENSITY = 1.225;

/** 공기 밀도(kg/m³) */
export function airDensity(altitude: number, temperatureC: number): number {
  const pressure = 101325 * Math.pow(1 - 2.25577e-5 * altitude, 5.25588);
  const kelvin = temperatureC + 273.15;
  return pressure / (287.05 * kelvin);
}

/** 음속(m/s) */
export function speedOfSound(temperatureC: number): number {
  return 331.3 * Math.sqrt(1 + temperatureC / 273.15);
}
