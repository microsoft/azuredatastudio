/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInsight, IInsightData } from './interfaces';

import { $ } from 'vs/base/browser/dom';
import { mixin } from 'vs/base/common/objects';
import { IInsightOptions, InsightType } from 'sql/workbench/parts/charts/common/interfaces';
import * as nls from 'vs/nls';

export interface IConfig extends IInsightOptions {
	encoding?: string;
	imageFormat?: string;
}

const defaultConfig: IConfig = {
	type: InsightType.Image,
	encoding: 'hex',
	imageFormat: 'jpeg'
};

export class ImageInsight implements IInsight {

	public static readonly types = [InsightType.Image];
	public readonly types = ImageInsight.types;

	private _options: IConfig;

	private imageEle: HTMLImageElement;

	constructor(container: HTMLElement, options: IConfig) {
		this._options = mixin(options, defaultConfig, false);
		this.imageEle = $('img');
		container.appendChild(this.imageEle);
	}

	public layout() {

	}

	public dispose() {

	}

	set options(config: IConfig) {
		this._options = mixin(config, defaultConfig, false);
	}

	get options(): IConfig {
		return this._options;
	}

	set data(data: IInsightData) {
		if (data.rows && data.rows.length > 0 && data.rows[0].length > 0) {
			let img = data.rows[0][0];
			if (this._options.encoding === 'hex') {
				img = ImageInsight._hexToBase64(img);
			}

			this.imageEle.onerror = function () {
				this.src = `data:image/$jpg;base64,iVBORw0KGgoAAAANSUhEUgAAAPkAAADwCAIAAABNIlUPAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAyZSURBVHhe7ZJbduO2AgSzkHxmn1nx3cPFuNuIXNaLIkHi0XXqI5mSJRLov/739z+3/hvCdGjb3HrRPYQpqMO+s/WiPxXC4Nyu+i/8f1UfDWFcMOk/W//9r1IphBHBmIveegFBuoUwFJix/G/rBTTpFsIgYMCy/PuPrRfwCekWQvdgulKJWy/gc9IthI7BaKXb3a0X8GnpFkKXYK7S7Yv7Wy/gb6RbCJ2BoUq3bx5uvYC/lG4hdAMmKt1ueLb1Av6+6hzC1WCZ0u0nL7ZewLdUnUO4DmxSuv3i9dYL+K6qcwhXgDVKt3u8tXWBL5VuIZwLdijdHrBh6wV8tXQL4SywQOn2mG1bL+AHpFsI7cH2pNtTNm+9gJ+RbiE0A5OrOr/ik60X8GPSLYQGYGxV5zf4cOsF/KR0C+FQMLOq83t8vvUCfli6hXAQGJh028KurRfwBNIthN1gWtJtI3u3XsBzSLcQdoBRSbftHLD1Ap5GuoXwEZiTdPuIY7ZewDNJtxA2giFJt085bOsFPJl0C+FtMCHptoMjt17A80m3EN4A45Fu+zh46wU8pXQL4SmYjXTbzfFbL+BZpVsID8BgpNsRNNl6AU8s3UL4BaYi3Q6i1dYLeG7pFsINGIl0O46GWy/g6aVbCF9gHtLtUNpuvYB3kG5heTAM6XY0zbdewJtIt7AwmIR0a8AZWy/gfaRbWBKMQbq14aStF/BWVeewEtiAdGvGeVsv4N2qzmENcPvSrSWnbr2AN6w6h9nBvUu3xpy9dYFXlW5hXnDj0q0912y9gBeWbmFGcNfS7RQu23oBry3dwlzglqXbWVy59QJeXrqFWcD9SrcTuXjrBRyBdAvjg5uVbudy/dYLOAjpFkYGdyrdTqeLrRdwHNItjAluU7pdQS9bL+BQpFsYDdyjdLuIjrZewNFItzAOuEHpdh19bb2AA5JuoXtwcVXnS+lu6wUck3QLHYMrqzpfTY9bL+CwpFvoElxW1bkDOt16AUcm3UJn4Jqqzn3Q79YLODjpFroBFyTdeqLrrRdwgtItdACuRrp1Ru9bL+AcpVu4FFyKdOuPAbZewGlKt3ARuA7p1iVjbL2AM5Vu4XRwEdKtV4bZegEnK93CieAKpFvHjLT1As5XuoVTwOFLt74ZbOsFnLJ0C43BsUu37hlv6wWcddU5tAGnLd1GYMitF3DiVedwNDhn6TYIo269gHOvOofjwAlLt3EYeOsFnH7VORwBzla6DcXYWxe4BukW9oFTlW6jMcPWC7gM6RY+Becp3QZkkq0XcCXSLWwHJyndxmSerRdwMdItbAFnKN2GZaqtF3A90i28B05Puo3MbFsv4JKkW3gFzk26Dc6EWy/gqqRbeAxOTLqNz5xbL+DCpFu4B85Kuk3BtFsv4NqkW/gJTkm6zcLMWy/g8qRb+AbnI90mYvKtF3CF0i2sdD7zb72Ai5Rua4MzkW7TscTWC7hO6bYqOA3pNiOrbL2AS5Vu64FzkG6TstDWC7ha6bYSOAHpNi9rbb2AC5ZuC4AXrzpPzXJbL+CapdvU4JWrzrOz4tYLuGzpNil42arzAiy69QKuXLpNB15Tui3Dulsv4O6l20TgBaXbSiy99QIWUHUeH7yXdFuM1bdewA6qziODN5Ju65Gt/wFrqDqPCd5Fui1Jtm6wiarzaOAtpNuqZOs/wDik2zjg+aXbwmTrBBORbiOAJ5dua5Ot3wFDkW59g2eWbsuTrd8Hc5FuvYKnlW4hW38CRiPd+gPPKd3CF9n6MzAd6dYTeELpFr7J1l+AAUm3PsCzSbdwQ7b+GsxIul0Nnkq6hZ9k62+BMUm368DzSLfwi2z9XTAp6XYFeBLpFu6RrW8Aw5Ju54JnkG7hAdn6NjAv6XYW+HXpFh6TrW8GI5Nu7cHvSrfwlGz9EzA16dYS/KJ0C6/I1j8Eg5NubcBvSbfwBtn652B20u1o8CvSLbxHtr4LjE+6HQe+X7qFt8nW94IJSrcjwDdLt7CFbP0AMETptg98p3QLG8nWjwFzlG6fgm+TbmE72fphYJRV543gS6Rb+Ihs/Ugwzarze+Bvq87hU7L1g8FAq86vwF9VncMOsvXjwUyrzo/B56vOYR/ZeiuwV+l2D3yy6hx2k603BKuVbj/BZ6RbOIhsvS2Yr3T7BlW6hePI1puDEUu3DP1EsvUzwJTlk38PLcjWTwKDfqQ/HRqQrZ8HZv1bfy60IVs/FYz7Vn8iNCNbPxtMXLqFlmTrp4KJ3+pPhGZk6+eBcf/WnwttyNZPArN+pD8dGpCtnwEGLZ/8e2hBtt4cTFm6Ze4nkq23BSOWbt+gSrdwHNl6QzBf6fYTfEa6hYPI1luB4Uq3e+CT0i0cQbbeBExWuj0Gn5duYTfZ+vFgrNLtFfgr6Rb2ka0fDGYq3d4Dfyvdwg6y9SPBQKXbFvANVefwEdn6YWCX0m07+J6qc9hOtn4MWKR0+xR8W9U5bCRbPwBsUbrtA99ZdQ5byNb3ghVKt4PAl0u38DbZ+i6wP+l2KPgJ6RbeI1v/HCxPujUAPyTdwhtk65+AwVWdm4Gfk27hFdn6ZjC1qnNj8KPSLTwlW98GRlZ1PgX8tHQLj8nWN4B5VZ1PBA8g3cIDsvV3wbCk2xXgSaRbuEe2/haYlHS7DjyPdAu/yNZfgzFJt6vBU0m38JNs/QWYkXTrAzybdAs3ZOvPwICkW0/gCaVb+CZbfwimI936A88p3cIX2fp9MBrp1it4WukWsvW7YC7SrW/wzNJtebJ1gqFItxHAk0u3tcnWf4CJSLdxwPNLt4XJ1v8D45Buo4G3kG6rkq0bzEK6jQneRbotSbb+BwxCuo0M3ki6rUe2Pvkg8F5V55VYfetYgHSbBbxd1XkZlt467l66zQXeseq8ButuHbcu3WYEb1p1XoBFt477lm5Tg1eWbrOz4tZx09JtAfDi0m1qlts67li6LQNeX7rNy1pbx+1Kt8XAIUi3SVlo67hX6bYkOArpNiOrbB03Kt0WBgci3aZjia3jLqXb8uBYpNtczL913KJ0C1/gcKTbREy+ddyfdAs34Iik2yzMvHXcnHQLv8BBSbcpmHPruLCqc3gAjku6jc+EW8dVVZ3DU3Bo0m1wZts6LqnqHN4ARyfdRmaqreN6pFvYAs5Qug3LPFvHxUi3sB2cpHQbk0m2jiuRbuFTcJ7SbUBm2DouQ7qFfeBUpdtoDL91XIN0C0eAs5VuQzH21nEB0i0cB05Yuo3DwFvH0Uu3cDQ4Z+k2CKNuHYcu3UIbcNrSbQSG3DqOW7qFluDMq859M97WccrSLbQHJ1917pjBto7zlW7hLHD+VedeGWnrOFnpFk4HFyHdumSYreNMpVu4CFyHdOuPMbaO05Ru4VJwKdKtMwbYOs5RuoUOwNVIt57ofes4QekWugEXJN26oeut4+ykW+gMXJN064N+t45Tk26hS3BZ0q0DOt06zku6hY7BlUm3q+lx6zgp6Ra6Bxcn3S6lu63jjKRbGARcn3S7jr62jtORbmEocInS7SI62jrORbqFAcFVSrcr6GXrOBHpFoYFFyrdTqeLreMspFsYHFyrdDuX67eOU5BuYQpwudLtRC7eOt5fuoWJwBVLt7O4bOt47apzmA5ctHQ7hWu2jheuOodJwXVLt/ZcsHW8atU5TA0uXbo15uyt4yWrzmEBcPXSrSWnbh2vJ93CSmAD0q0Z520dLybdwnpgCVXnBpy0dbyPdAurgj1UnY/mjK3jTaRbWBusoup8KM23jneQbiF8gXlIt+Nou3U8vXQL4QaMRLodRMOt47mlWwi/wFSk2xG02jqeWLqF8AAMRrrtpsnW8azSLYSnYDbSbR/Hbx1PKd1CeAOMR7rt4OCt4/mkWwhvgwlJt085cut4MukWwkYwJOn2EYdtHc8k3UL4CMxJum3nmK3jaaRbCDvAqKTbRg7YOp5DuoWwG0xLum1h79bxBNIthIPAwKTb2+zaOn5buoVwKJiZdHuPz7eOX5VuITQAY5Nub/Dh1vF70i2EZmBy0u0Vn2wdvyTdQmgMhifdnrJ56/gN6RbCKWB+0u0x27aOb5duIZwIRijdHrBh6/he6RbC6WCK0u0e724d3yjdQrgIDFK6/eKtreO7pFsIl4JZSrefvN46vkW6hdABGGfV+ZtnW8dfVp1D6AZMtOr8xcOt42+qziF0BoZadX60dXy66hxCr2CxUunO1vG5qnMIfYPdyvLv3Do+Id1CGAQMWP7YOpp0C2EoMOPif1tHkG4hDAjG7K3jX6VSCONyu+c/W7/9/6o+GsLo1En/Vf/rVn8qhCn4s+q///k/Gmpj6opufUIAAAAASUVORK5CYII=`;
				alert(nls.localize('invalidImage', "Error: Table is not a valid image"));
			};

			this.imageEle.src = `data:image/${this._options.imageFormat};base64,${img}`;
		}
	}

	private static _hexToBase64(hexVal: string) {

		if (hexVal.startsWith('0x')) {
			hexVal = hexVal.slice(2);
		}
		// should be able to be replaced with new Buffer(hexVal, 'hex').toString('base64')
		return btoa(String.fromCharCode.apply(null, hexVal.replace(/\r|\n/g, '').replace(/([\da-fA-F]{2}) ?/g, '0x$1 ').replace(/ +$/, '').split(' ').map(v => Number(v))));
	}
}
