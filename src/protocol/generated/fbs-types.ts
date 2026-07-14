/**
 * AUTO-GENERATED public FBS protocol metadata types.
 * Do not edit by hand. Run scripts/generate-fbs-protocol.mjs.
 */

export type FBSScalarType =
  | 'bool'
  | 'byte'
  | 'ubyte'
  | 'short'
  | 'ushort'
  | 'int'
  | 'uint'
  | 'long'
  | 'ulong'
  | 'float'
  | 'double'
  | 'string';

export interface FBSProtocolEnumValue {
  name: string;
  value: number;
  literal: string | null;
  implicit: boolean;
  sourceLine: number;
  description?: string;
}

export interface FBSProtocolEnum {
  name: string;
  namespace: string;
  underlyingType: FBSScalarType;
  sourceFile: string;
  sourceLine: number;
  description?: string;
  values: FBSProtocolEnumValue[];
}

export interface FBSProtocolReference {
  schemaVersion: 1;
  generatedFrom: typeof FBS_PROTOCOL_SOURCE;
  namespaces: string[];
  enumCount: number;
  valueCount: number;
  enums: FBSProtocolEnum[];
}

/** Source revision and integrity hashes for the public vendored FBS snapshot. */
export const FBS_PROTOCOL_SOURCE = {
    "schemaVersion": 1,
    "source": {
      "repository": "gestalt_system",
      "commit": "cfab7571284ab1ba379f97c0ed196986d792ec8e",
      "path": "TypeScript/RobotBridgeDemo/FBS"
    },
    "normalization": {
      "lineEndings": "LF",
      "licenseHeader": "Public SDK Protocol Schema; distributed under the gestalt-hud-sdk repository LICENSE",
      "comments": "Latin-1/UTF-8 mojibake repaired in comments only; enum and value tokens are unchanged",
      "upstreamHashInput": "Git blob bytes at source.commit (independent of checkout line-ending conversion)"
    },
    "files": [
      {
        "name": "RobotBridgeDemoAttributeDefines.fbs",
        "upstreamSha256": "d920a353e9c21348443e1e552e59e3c7e78668a5bd72b84a4e7bf184ab630005",
        "vendoredSha256": "890693ee22cc046c69ba883a479bf36547d6095d5bc0ba890127290b600f63ca"
      },
      {
        "name": "RobotBridgeDemoEntityDefine.fbs",
        "upstreamSha256": "5cd460d84b7de7f4d67017d082cfbf92b4dab4ecc2c8de8e9875c0ae6a6b2ec4",
        "vendoredSha256": "32e877884de308231b2f59b7078d990a92dec3bfe8c43d37129905bc6b774a34"
      },
      {
        "name": "RobotBridgeDemoInputDefine.fbs",
        "upstreamSha256": "78c0e91bf5cef4c6737cb6efd5d77616a001c76e738ec62e3ac797557a7a991c",
        "vendoredSha256": "15e8446bc1a1e30d5d02c15287e81d0a5c405f0d7bed2c7d182c8f2663821c77"
      },
      {
        "name": "RobotBridgeDemoMapDefine.fbs",
        "upstreamSha256": "ebf42fd119f8461cb2fe8b3dcc463f5392397f3bc29db4308cab164b9fd9ab9d",
        "vendoredSha256": "e5b4cdb9dd791e51724c55a4b1e696be2ab104d6cd41bdfe90052eb0e632f7f1"
      },
      {
        "name": "RobotBridgeDemoResourceIdDefine.fbs",
        "upstreamSha256": "e7c41d9d8544666a7260835faefa029a7e3a2c7edee766a3b07e00de982ddc85",
        "vendoredSha256": "0970ac906b52c97c6ca538b64ff5b7eef3d6e0b6726a675fd3be2d8bb3bea0a4"
      },
      {
        "name": "RobotBridgeDemoTransformIdDefine.fbs",
        "upstreamSha256": "ffcddf92f4b7ff11cd4a839c33ef637873d62a1c2fea952b597a40dbbe5ddb14",
        "vendoredSha256": "a1b5c083b9d6bbd24c992b696bb32aad82722c7f2bdeb9ebc93694d40b6b526b"
      },
      {
        "name": "RobotBridgeDemoUniversalEventDefine.fbs",
        "upstreamSha256": "40ccc58b051eab1f6f5c8dbe97dd3bc6e481592dfe8a6c09a54aab2027039626",
        "vendoredSha256": "1e37be48e5e8c362dcfa63282cc59f983bc2f1f48edab049ad6175af6073476e"
      }
    ]
  } as const;
