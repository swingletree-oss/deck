import { ConfigurationService } from "../src/configuration";
import * as sinon from "sinon";


export class ConfigurationServiceMock extends ConfigurationService {
	constructor() {
		super();
		const configStub = sinon.stub();

		this.get = configStub;
	}
}

