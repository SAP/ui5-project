# Changelog
All notable changes to this project will be documented in this file.  
This project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

A list of unreleased changes can be found [here](https://github.com/SAP/ui5-project/compare/v3.1.0...HEAD).

<a name="v3.1.0"></a>
## [v3.1.0] - 2023-03-31
### Bug Fixes
- **Taskrunner:** pass new taskutil options to determineRequiredDependencies hook [`94bcd99`](https://github.com/SAP/ui5-project/commit/94bcd9931d6709170b78a92e7372bbd0de44ae03)
- **ui5Framework:** Prevent install of libraries within workspace ([#589](https://github.com/SAP/ui5-project/issues/589)) [`8ffc676`](https://github.com/SAP/ui5-project/commit/8ffc676434defd320c70b615960efc9182a29de9)

### Features
- **Specification:** Add getId method [`7bdb47a`](https://github.com/SAP/ui5-project/commit/7bdb47a2925c0936ee33faf23f51f6c6ab396369)
- **Workspace:** Add getModules method [`1e2aa0e`](https://github.com/SAP/ui5-project/commit/1e2aa0e48bb2d895728f3d5f4cb74d55fbc8ec34)


<a name="v3.0.4"></a>
## [v3.0.4] - 2023-03-10
### Bug Fixes
- Resolve properly absolute path for ui5HomeDir ([#588](https://github.com/SAP/ui5-project/issues/588)) [`9b414a7`](https://github.com/SAP/ui5-project/commit/9b414a77a1d86f6a3560231ae04db407e2f022c5)


<a name="v3.0.3"></a>
## [v3.0.3] - 2023-03-01
### Bug Fixes
- **jsdoc:** enable generateVersionInfo task [`a58e5eb`](https://github.com/SAP/ui5-project/commit/a58e5eb0769a9ba63a0b0aa267675ef2f9c08769)


<a name="v3.0.2"></a>
## [v3.0.2] - 2023-02-17
### Bug Fixes
- **ComponentProject#getWorkspace:** Apply builder resource excludes [`5257e59`](https://github.com/SAP/ui5-project/commit/5257e5977c4e92e2aca5b0ce4b2ed55688a66646)


<a name="v3.0.1"></a>
## [v3.0.1] - 2023-02-16
### Bug Fixes
- Prevent socket timeouts when installing framework libraries [`a198356`](https://github.com/SAP/ui5-project/commit/a198356c9c5f39dd94fb8cf7542d9059ee628f3b)
- **Library:** Do not throw for missing .library file [`1163821`](https://github.com/SAP/ui5-project/commit/11638210994fd9511b2ab5ee3da40e3ccf294e58)
- **Project#getReader:** Do not apply builder resource excludes for style 'runtime' [`1cd94f7`](https://github.com/SAP/ui5-project/commit/1cd94f7f15ed07283e198238edb546517ee25691)
- **TaskUtil:** Provide framework configuration getters to custom tasks ([#580](https://github.com/SAP/ui5-project/issues/580)) [`6a40927`](https://github.com/SAP/ui5-project/commit/6a409278285252da59ea4d42fcf154814518661d)
- **graph:** Always resolve rootConfigPath to CWD [`ef3e569`](https://github.com/SAP/ui5-project/commit/ef3e56996111233aaa04410c95f11b1c3495a9b2)
- **projectGraphBuilder:** Apply extensions of the same module only once [`6d753a8`](https://github.com/SAP/ui5-project/commit/6d753a850f2a4ca34a50f64a404472bf0081054e)
- **ui5Framework:** Improve error handling for duplicate lib declaration [`fb1db6d`](https://github.com/SAP/ui5-project/commit/fb1db6d7cb74dee9c4754ffb62a2a970cb0e2fbe)


<a name="v3.0.0"></a>
## [v3.0.0] - 2023-02-09
### Breaking Changes
- Implement Project Graph, build execution [`161f462`](https://github.com/SAP/ui5-project/commit/161f462cf6a9955337fff512007125128c6c39dd)
- Run 'generateThemeDesignerResources' only on framework libs [`e4bb108`](https://github.com/SAP/ui5-project/commit/e4bb1084df3e0ae906df27aba4a674d187ff8069)

### BREAKING CHANGE
Support for older Node.js and npm releases has been dropped for all UI5 Tooling modules.
Only Node.js versions v16.18.0, v18.12.0 or higher as well as npm v8 or higher are supported.

All packages have been transformed to ES Modules. Therefore modules are no longer provides a CommonJS exports.
If your project uses CommonJS, it needs to be converted to ESM or use a dynamic import for consuming UI5 Tooling modules.

For more information see also:
- https://sap.github.io/ui5-tooling/updates/migrate-v3/
- https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c

- normalizer and projectTree APIs have been removed. Use generateProjectGraph instead
- Going forward only specification versions 2.0 and higher are supported
    - In case a legacy specification version is detected, an automatic, transparent migration is attempted.
- Build:
    - The "dev" build mode has been removed
    - The task "generateVersionInfo" is no longer executed for application projects by default. You may enable it again using the includedTasks parameter

### Features
- specVersion 3.0 ([#522](https://github.com/SAP/ui5-project/issues/522)) [`c5070e5`](https://github.com/SAP/ui5-project/commit/c5070e55d92ced4326cd7611caf3ec9a3da9e7ed)
- Introduce SpecificationVersion class ([#431](https://github.com/SAP/ui5-project/issues/431)) [`e57842b`](https://github.com/SAP/ui5-project/commit/e57842b06397a5b36e6373df97f7b7bb91f09741)
- **TaskRunner:** Provide taskName and logger instance to custom tasks [`36cd2d8`](https://github.com/SAP/ui5-project/commit/36cd2d83f9a6a92cbd28619d8a25c0ba3f732117)
- **TaskUtil:** Add resourceFactory API to v3 interface [`2e863cf`](https://github.com/SAP/ui5-project/commit/2e863cfaf9f8924d0c87fe9dfe01568c1fd979c8)
- **TaskUtil:** Add getProject/getDependencies API to interface [`51f2949`](https://github.com/SAP/ui5-project/commit/51f29493f57f094396776bb2686c8a74e8901a7f)

### Bug Fixes
- **npm/Installer:** Do not wrap promise provided by rimraf v4 [`2d1ccda`](https://github.com/SAP/ui5-project/commit/2d1ccda54edd29dabadcb7bad9136bff09da8eac)
- **ProjectBuilder:** Fix verbose logging for already built projects [`f04ffd2`](https://github.com/SAP/ui5-project/commit/f04ffd2c0ab0270df697c20258474ff536811476)
- **ProjectBuilder:** Skip build for projects that do not require to be built [`ac5f1f8`](https://github.com/SAP/ui5-project/commit/ac5f1f891255b56597e51d121329f03786338d4a)
- **Specification:** Fix migration for legacy projects that are not applications or libraries [`d89d804`](https://github.com/SAP/ui5-project/commit/d89d8047519ca8f162dc7a225f138ae304871ecb)
- Fix build manifest creation [`b1459eb`](https://github.com/SAP/ui5-project/commit/b1459eb26aa8a4b18ad84a369c122c114d64b64b)

### Dependency Updates
- Bump rimraf from 3.0.2 to 4.1.1 ([#550](https://github.com/SAP/ui5-project/issues/550)) [`99876ae`](https://github.com/SAP/ui5-project/commit/99876ae35e9d8f5c725e2e87bd3be37d7ed4363c)


<a name="v2.6.0"></a>
## [v2.6.0] - 2021-10-19
### Bug Fixes
- **ui5Framework:** Skip processing of framework libs ([#424](https://github.com/SAP/ui5-project/issues/424)) [`539d953`](https://github.com/SAP/ui5-project/commit/539d9539a5d2aaa6d01c4f539e3c86d8269788f2)

### Features
- specVersion 2.6 [`9bd921a`](https://github.com/SAP/ui5-project/commit/9bd921a05bd5c0d8b6c6d94a864e60e4e181ad63)


<a name="v2.5.0"></a>
## [v2.5.0] - 2021-07-23
### Features
- specVersion 2.5 [`3008dac`](https://github.com/SAP/ui5-project/commit/3008dace09109ba0fac49f0ddfc79255038f192c)


<a name="v2.4.0"></a>
## [v2.4.0] - 2021-06-01
### Features
- specVersion 2.4 [`69ffc6c`](https://github.com/SAP/ui5-project/commit/69ffc6c34e387bcaaaf7b703559181b78fd33d54)


<a name="v2.3.1"></a>
## [v2.3.1] - 2021-03-04
### Bug Fixes
- **ui5Framework:** Don't access metadata of deduped projects [`0255f8f`](https://github.com/SAP/ui5-project/commit/0255f8f628281ecb3cbbdb50192d2d4721bccea2)

### Dependency Updates
- Bump js-yaml from 3.14.1 to 4.0.0 ([#380](https://github.com/SAP/ui5-project/issues/380)) [`a862186`](https://github.com/SAP/ui5-project/commit/a86218657703a5b607ebd09f8f71dd7ea810c6be)


<a name="v2.3.0"></a>
## [v2.3.0] - 2021-02-09
### Features
- specVersion 2.3 ([#388](https://github.com/SAP/ui5-project/issues/388)) [`3e28026`](https://github.com/SAP/ui5-project/commit/3e280267b60a9a72183d5ab0905d838b6fcfaf33)


<a name="v2.2.6"></a>
## [v2.2.6] - 2021-01-28
### Bug Fixes
- **ui5Framework.Installer:** Ensure target directory does not exist before rename ([#390](https://github.com/SAP/ui5-project/issues/390)) [`f107cdf`](https://github.com/SAP/ui5-project/commit/f107cdf2b1703791c153009150a5e1713e123b73)


<a name="v2.2.5"></a>
## [v2.2.5] - 2021-01-26
### Bug Fixes
- **ui5Framework.Installer:** Ensure atomic install process [`72568a9`](https://github.com/SAP/ui5-project/commit/72568a990620cee69ffaf2470c684a7ba02c200c)


<a name="v2.2.4"></a>
## [v2.2.4] - 2020-11-06
### Performance Improvements
- Reduce install size by removing 'string.prototype.matchall' dependency [`b69d75e`](https://github.com/SAP/ui5-project/commit/b69d75e740bfc594668ea73273bb03fdd40a4ce2)
- **validator:** Lazy load dependencies [`609346b`](https://github.com/SAP/ui5-project/commit/609346b2b1bb0417fde36a35ec43e9970c68504f)


<a name="v2.2.3"></a>
## [v2.2.3] - 2020-10-22
### Bug Fixes
- **Schema:** Add missing bundle section "name" [`ba2d601`](https://github.com/SAP/ui5-project/commit/ba2d6015b6a04af92edb8f1b779a229fe73b705a)


<a name="v2.2.2"></a>
## [v2.2.2] - 2020-09-15
### Bug Fixes
- **ui5Framework.mergeTrees:** Do not abort merge if a project has already been processed [`264c353`](https://github.com/SAP/ui5-project/commit/264c353b6973bade57164aded4f10a668986482d)


<a name="v2.2.1"></a>
## [v2.2.1] - 2020-09-02

<a name="v2.2.0"></a>
## [v2.2.0] - 2020-08-11
### Features
- specVersion 2.2 ([#341](https://github.com/SAP/ui5-project/issues/341)) [`f44d14e`](https://github.com/SAP/ui5-project/commit/f44d14e136a4163d59dd8fd8c0be0ea2b59930be)


<a name="v2.1.5"></a>
## [v2.1.5] - 2020-07-14
### Bug Fixes
- **Node.js API:** TypeScript type definition support ([#335](https://github.com/SAP/ui5-project/issues/335)) [`c610305`](https://github.com/SAP/ui5-project/commit/c610305e8fb869461a8dd5ba876270c7f7b71a22)


<a name="v2.1.4"></a>
## [v2.1.4] - 2020-05-29
### Bug Fixes
- **ui5Framework:** Allow providing exact prerelease versions ([#326](https://github.com/SAP/ui5-project/issues/326)) [`6ce985c`](https://github.com/SAP/ui5-project/commit/6ce985c8feab26e6a97ca4570b3931f507773666)


<a name="v2.1.3"></a>
## [v2.1.3] - 2020-05-14

<a name="v2.1.2"></a>
## [v2.1.2] - 2020-05-11
### Bug Fixes
- **framework t8r:** Allow use of specVersion 2.1 [`961847d`](https://github.com/SAP/ui5-project/commit/961847d113e6f594526201ab9ecccb898d2497e2)


<a name="v2.1.1"></a>
## [v2.1.1] - 2020-05-11
### Bug Fixes
- Allow the use of specVersion 2.1 for projects [`a42172f`](https://github.com/SAP/ui5-project/commit/a42172fc341666b8d9a9b6049c365b28c55c76f0)


<a name="v2.1.0"></a>
## [v2.1.0] - 2020-05-05
### Features
- **specVersion 2.1:** Add support for "customConfiguration" ([#308](https://github.com/SAP/ui5-project/issues/308)) [`201aaab`](https://github.com/SAP/ui5-project/commit/201aaab6beb8ad86fefdf371ae20c971970f6547)


<a name="v2.0.4"></a>
## [v2.0.4] - 2020-04-30
### Bug Fixes
- Workaround missing dependency info for OpenUI5 packages in version 1.77.x [`3dfb812`](https://github.com/SAP/ui5-project/commit/3dfb8126e347fd1e7f6cc87e20318298e19eaf70)
- Namespaces in API Reference (JSDoc) [`3174d9f`](https://github.com/SAP/ui5-project/commit/3174d9f21f471252d2a39b8cb085eeeb5debe0a6)


<a name="v2.0.3"></a>
## [v2.0.3] - 2020-04-02
### Bug Fixes
- **Schema:** Add missing metadata properties [`16894e1`](https://github.com/SAP/ui5-project/commit/16894e11c5c21a77a405431dfaf5d8642accfc1d)
- **package.json:** Downgrade pacote from 11.1.4 to 9.5.12 [`c76fb49`](https://github.com/SAP/ui5-project/commit/c76fb49e64b5905a3cd592d94fc0076cecc909b5)


<a name="v2.0.2"></a>
## [v2.0.2] - 2020-04-01
### Bug Fixes
- **ui5Framework t8r:** Resolve versionOverride string [`4fffabe`](https://github.com/SAP/ui5-project/commit/4fffabe2a417b1ea46a47546c6269ac0ffbc3931)


<a name="v2.0.1"></a>
## [v2.0.1] - 2020-04-01
### Bug Fixes
- **ui5Framework.mergeTrees:** Do not process the same project multiple times [`1377ec2`](https://github.com/SAP/ui5-project/commit/1377ec2ecea71a2470a9ea9b1e0698e466154838)


<a name="v2.0.0"></a>
## [v2.0.0] - 2020-03-31
### Breaking Changes
- Require Node.js >= 10 [`f21e704`](https://github.com/SAP/ui5-project/commit/f21e704f85297e3fa774c59bf5d4e8282b947b41)

### Features
- Add Configuration Schema ([#274](https://github.com/SAP/ui5-project/issues/274)) [`eb961c3`](https://github.com/SAP/ui5-project/commit/eb961c3377d42d3c93f7b7db5033f4e6716ddc71)
- Support for spec version 2.0 ([#277](https://github.com/SAP/ui5-project/issues/277)) [`770a56f`](https://github.com/SAP/ui5-project/commit/770a56feed331a3157c9f9fad486a4674dc12c87)
- Add ui5Framework translator and resolvers ([#265](https://github.com/SAP/ui5-project/issues/265)) [`5183e5c`](https://github.com/SAP/ui5-project/commit/5183e5cf99ac8cae6e4ccc8030d94214bce0563c)
- **projectPreprocessor:** Log warning when using a deprecated or restricted dependency ([#268](https://github.com/SAP/ui5-project/issues/268)) [`b776a4f`](https://github.com/SAP/ui5-project/commit/b776a4fcc4604f3ecb0d3fc1e6418ed190c11756)

### BREAKING CHANGE

Support for older Node.js releases has been dropped.
Only Node.js v10 or higher is supported.


<a name="v1.2.0"></a>
## [v1.2.0] - 2020-01-13
### Features
- Add specification version 1.1 ([#252](https://github.com/SAP/ui5-project/issues/252)) [`5a83308`](https://github.com/SAP/ui5-project/commit/5a833086ccd415c5557c2bc3bbb705c18ac54314)


<a name="v1.1.1"></a>
## [v1.1.1] - 2019-11-07

<a name="v1.1.0"></a>
## [v1.1.0] - 2019-07-11
### Features
- **projectPreprocessor:** Add handling for server-middleware extensions [`2ce964c`](https://github.com/SAP/ui5-project/commit/2ce964cd9feb6c1da39cd783ad45e0030c46b81a)


<a name="v1.0.3"></a>
## [v1.0.3] - 2019-06-25
### Bug Fixes
- **projectPreprocessor:** Do not remove already removed dependencies ([#189](https://github.com/SAP/ui5-project/issues/189)) [`4600d63`](https://github.com/SAP/ui5-project/commit/4600d63cf323d3e143072c6c3416b5a48e90bb71)


<a name="v1.0.2"></a>
## [v1.0.2] - 2019-04-12
### Bug Fixes
- **ProjectPreprocessor:** Fix dependency resolution [`0671a8b`](https://github.com/SAP/ui5-project/commit/0671a8bf2de9ca24823df6f041a77e7c8e46f6f0)

### Dependency Updates
- Bump [@ui5](https://github.com/ui5)/builder from 1.0.2 to 1.0.3 ([#154](https://github.com/SAP/ui5-project/issues/154)) [`cf86764`](https://github.com/SAP/ui5-project/commit/cf867643b8b621019a5d5b0f5d3117ebcdd1cd44)


<a name="v1.0.1"></a>
## [v1.0.1] - 2019-02-14
### Bug Fixes
- **npm translator:** Remove deduped optional dependencies from tree [`3481154`](https://github.com/SAP/ui5-project/commit/348115426f03bd3a5bb823ac54a6b15475a84657)

### Dependency Updates
- Bump [@ui5](https://github.com/ui5)/builder from 1.0.0 to 1.0.1 ([#113](https://github.com/SAP/ui5-project/issues/113)) [`96a3d6a`](https://github.com/SAP/ui5-project/commit/96a3d6a2a54cb1eab190ba89f9da686e8aae2d84)


<a name="v1.0.0"></a>
## [v1.0.0] - 2019-01-10
### Breaking Changes
- **normalizer:** Rename optional parameter "translator" [`92321e0`](https://github.com/SAP/ui5-project/commit/92321e08e43175611b8417047fc957792d539b10)

### Dependency Updates
- Bump [@ui5](https://github.com/ui5)/builder from 0.2.9 to 1.0.0 ([#99](https://github.com/SAP/ui5-project/issues/99)) [`7dd5d5c`](https://github.com/SAP/ui5-project/commit/7dd5d5cda909e3a109821315cc5a5a80f05cd5d3)
- Bump [@ui5](https://github.com/ui5)/logger from 0.2.2 to 1.0.0 ([#98](https://github.com/SAP/ui5-project/issues/98)) [`8068a76`](https://github.com/SAP/ui5-project/commit/8068a76dc43701f5c8b0467933a83d777ccdee01)

### Features
- Add specification version 1.0 [`b0c02f6`](https://github.com/SAP/ui5-project/commit/b0c02f67296f6251a7ef4fe5c61146bb169a6705)

### BREAKING CHANGE

Renamed parameter "translator" of functions generateDependencyTree and generateProjectTree to "translatorName"


<a name="v0.2.5"></a>
## [v0.2.5] - 2018-12-19
### Bug Fixes
- **npm translator:** Deduplicate subtrees of pending dependencies [`7e55ae3`](https://github.com/SAP/ui5-project/commit/7e55ae3d88280746f5800bffc7bbd13e1495ba07)
- **npm translator:** Fix handling of indirect dependency cycles [`c99d6d3`](https://github.com/SAP/ui5-project/commit/c99d6d3a19fbb6c197b449dfd6cb8acc48837dba)


<a name="v0.2.4"></a>
## [v0.2.4] - 2018-12-17
### Bug Fixes
- **npm t8r:** Add deduplication of npm dependencies [`2717088`](https://github.com/SAP/ui5-project/commit/2717088532d415b6922f290b58d9227b946a965f)
- **projectPreprocessor:** Ignore deduped modules [`84f7b25`](https://github.com/SAP/ui5-project/commit/84f7b25a9e45df3bc55a7957e4f61db580e68509)


<a name="v0.2.3"></a>
## [v0.2.3] - 2018-11-20
### Bug Fixes
- **npm t8r:** Again, handle npm optionalDependencies correctly [`9fd78dc`](https://github.com/SAP/ui5-project/commit/9fd78dca4d836f9a37036fd151a78e9295b28aa1)


<a name="v0.2.2"></a>
## [v0.2.2] - 2018-11-17
### Bug Fixes
- **npm t8r:** Handle npm optionalDependencies correctly [`da707d7`](https://github.com/SAP/ui5-project/commit/da707d73b5c75b489e2e499de2b4f54924018844)

### Features
- **projectPreprocessor:** Add handling for task extensions [`0722865`](https://github.com/SAP/ui5-project/commit/072286591ae3b20cca8e418030c3f2bc048352c5)
- **projectPreprocessor:** Allow application project dependency on non-root level [`b8a59d5`](https://github.com/SAP/ui5-project/commit/b8a59d56c8b5cf4c330fe99cb2162c1701aa51ca)


<a name="v0.2.1"></a>
## [v0.2.1] - 2018-10-29
### Features
- Add shim extension [`93c9b39`](https://github.com/SAP/ui5-project/commit/93c9b3960ca36f240c5f8453a89f72792a01fe92)
- Add "extension" projects [`476b785`](https://github.com/SAP/ui5-project/commit/476b785810d6993d2a3e21707ffa67e568e67eac)


<a name="v0.2.0"></a>
## [v0.2.0] - 2018-07-11

<a name="v0.1.0"></a>
## [v0.1.0] - 2018-06-26
### Bug Fixes
- Fix some typos in log messages ([#17](https://github.com/SAP/ui5-project/issues/17)) [`1f2f2fd`](https://github.com/SAP/ui5-project/commit/1f2f2fd164abaf449cc5e7d94ec792f469710207)
- **npm translator:** Fix endless loop in case of dependency cycles ([#15](https://github.com/SAP/ui5-project/issues/15)) [`cf31112`](https://github.com/SAP/ui5-project/commit/cf3111288278e8dd36a09b549bd2b254e86af041)


<a name="v0.0.1"></a>
## v0.0.1 - 2018-06-06
### Bug Fixes
- **npm t8r:** Fix collection fallback with missing package.json [`578466f`](https://github.com/SAP/ui5-project/commit/578466fdedf871091874c93d1a9305859e34e3ed)
[v3.1.0]: https://github.com/SAP/ui5-project/compare/v3.0.4...v3.1.0
[v3.0.4]: https://github.com/SAP/ui5-project/compare/v3.0.3...v3.0.4
[v3.0.3]: https://github.com/SAP/ui5-project/compare/v3.0.2...v3.0.3
[v3.0.2]: https://github.com/SAP/ui5-project/compare/v3.0.1...v3.0.2
[v3.0.1]: https://github.com/SAP/ui5-project/compare/v3.0.0...v3.0.1
[v3.0.0]: https://github.com/SAP/ui5-project/compare/v2.6.0...v3.0.0
[v2.6.0]: https://github.com/SAP/ui5-project/compare/v2.5.0...v2.6.0
[v2.5.0]: https://github.com/SAP/ui5-project/compare/v2.4.0...v2.5.0
[v2.4.0]: https://github.com/SAP/ui5-project/compare/v2.3.1...v2.4.0
[v2.3.1]: https://github.com/SAP/ui5-project/compare/v2.3.0...v2.3.1
[v2.3.0]: https://github.com/SAP/ui5-project/compare/v2.2.6...v2.3.0
[v2.2.6]: https://github.com/SAP/ui5-project/compare/v2.2.5...v2.2.6
[v2.2.5]: https://github.com/SAP/ui5-project/compare/v2.2.4...v2.2.5
[v2.2.4]: https://github.com/SAP/ui5-project/compare/v2.2.3...v2.2.4
[v2.2.3]: https://github.com/SAP/ui5-project/compare/v2.2.2...v2.2.3
[v2.2.2]: https://github.com/SAP/ui5-project/compare/v2.2.1...v2.2.2
[v2.2.1]: https://github.com/SAP/ui5-project/compare/v2.2.0...v2.2.1
[v2.2.0]: https://github.com/SAP/ui5-project/compare/v2.1.5...v2.2.0
[v2.1.5]: https://github.com/SAP/ui5-project/compare/v2.1.4...v2.1.5
[v2.1.4]: https://github.com/SAP/ui5-project/compare/v2.1.3...v2.1.4
[v2.1.3]: https://github.com/SAP/ui5-project/compare/v2.1.2...v2.1.3
[v2.1.2]: https://github.com/SAP/ui5-project/compare/v2.1.1...v2.1.2
[v2.1.1]: https://github.com/SAP/ui5-project/compare/v2.1.0...v2.1.1
[v2.1.0]: https://github.com/SAP/ui5-project/compare/v2.0.4...v2.1.0
[v2.0.4]: https://github.com/SAP/ui5-project/compare/v2.0.3...v2.0.4
[v2.0.3]: https://github.com/SAP/ui5-project/compare/v2.0.2...v2.0.3
[v2.0.2]: https://github.com/SAP/ui5-project/compare/v2.0.1...v2.0.2
[v2.0.1]: https://github.com/SAP/ui5-project/compare/v2.0.0...v2.0.1
[v2.0.0]: https://github.com/SAP/ui5-project/compare/v1.2.0...v2.0.0
[v1.2.0]: https://github.com/SAP/ui5-project/compare/v1.1.1...v1.2.0
[v1.1.1]: https://github.com/SAP/ui5-project/compare/v1.1.0...v1.1.1
[v1.1.0]: https://github.com/SAP/ui5-project/compare/v1.0.3...v1.1.0
[v1.0.3]: https://github.com/SAP/ui5-project/compare/v1.0.2...v1.0.3
[v1.0.2]: https://github.com/SAP/ui5-project/compare/v1.0.1...v1.0.2
[v1.0.1]: https://github.com/SAP/ui5-project/compare/v1.0.0...v1.0.1
[v1.0.0]: https://github.com/SAP/ui5-project/compare/v0.2.5...v1.0.0
[v0.2.5]: https://github.com/SAP/ui5-project/compare/v0.2.4...v0.2.5
[v0.2.4]: https://github.com/SAP/ui5-project/compare/v0.2.3...v0.2.4
[v0.2.3]: https://github.com/SAP/ui5-project/compare/v0.2.2...v0.2.3
[v0.2.2]: https://github.com/SAP/ui5-project/compare/v0.2.1...v0.2.2
[v0.2.1]: https://github.com/SAP/ui5-project/compare/v0.2.0...v0.2.1
[v0.2.0]: https://github.com/SAP/ui5-project/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/SAP/ui5-project/compare/v0.0.1...v0.1.0
