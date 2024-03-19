import * as packageJson from '../../../../../package.json'
import {InjectedCustomProvider} from './injected-custom-provider'

const profile = {
  name: 'injected-truezk-testnet-provider',
  displayName: 'Injected TrueZK Testnet Provider',
  kind: 'provider',
  description: 'injected TrueZK Testnet Provider',
  methods: ['sendAsync', 'init'],
  version: packageJson.version
}

export class InjectedTrueZKProvider extends InjectedCustomProvider {
  constructor() {
    super(profile, 'TrueZK Testnet', '0x3affd', ['https://testnet.truezk.com'])
  }
}
