import { API, AccessoryPlugin, Service, Logging, AccessoryConfig, HAP } from 'homebridge';
import { SerialPort, ReadlineParser } from 'serialport';
import { readFileSync } from 'fs';

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory('ArduinoTemperature', ArduinoTemperatureAccessory);
};

class ArduinoTemperatureAccessory implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly name: string;

  private readonly informationService: Service;
  private readonly temperatureSensorService: Service;

  private readonly arduinoCom: SerialPort;
  private temp = 0.0;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;

    this.informationService = new hap.Service.AccessoryInformation(this.name)
      .setCharacteristic(hap.Characteristic.Manufacturer, 'jkelol111')
      .setCharacteristic(hap.Characteristic.SerialNumber, '001')
      .setCharacteristic(hap.Characteristic.Model, 'Arduino Temperature Sensor');

    this.temperatureSensorService = new hap.Service.TemperatureSensor(this.name);

    this.temperatureSensorService.getCharacteristic(hap.Characteristic.CurrentTemperature)
      .onGet(this.handleCurrentTemperatureGet.bind(this));

    this.arduinoCom = new SerialPort(
      {
        path: JSON.parse(readFileSync(api.user.configPath()).toString())
          .accessories.find(obj => obj.accessory === 'ArduinoTemperature').serialPath,
        baudRate: 9600,
      },
    );

    this.arduinoCom.pipe(new ReadlineParser());

    this.arduinoCom.on('data', chunk => {
      this.temp = parseFloat(chunk.toString());
    });

    [
      'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
      'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM',
    ].forEach(evt => process.on(evt, (evtOrExitCodeOrError: number | string | Error) => {
      this.log.debug(`Received kill event with message: ${evtOrExitCodeOrError}`);
      if (this.arduinoCom.isOpen) {
        this.arduinoCom.close(err => {
          if (err) {
            this.log.error(err?.message ?? 'Unknown error on serial port close.');
          }
          process.exit(isNaN(+evtOrExitCodeOrError) ? 1 : +evtOrExitCodeOrError);
        });
      }
      process.exit(isNaN(+evtOrExitCodeOrError) ? 1 : +evtOrExitCodeOrError);
    }));

    this.log.info('Temperature sensor finished initializing!');
  }

  getServices(): Service[] {
    this.log.debug('Handling services get.');
    return [
      this.informationService,
      this.temperatureSensorService,
    ];
  }

  handleCurrentTemperatureGet(): number {
    this.log.debug('Handling temperature get.');
    this.log.debug(`temp=${this.temp}`);
    return this.temp;
  }
}
