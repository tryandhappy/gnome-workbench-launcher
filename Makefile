UUID := workbench-launcher@tryandhappy
PACKAGE := workbench-launcher.zip

.PHONY: check install package clean

check:
	node --check extension.js
	python3 -m json.tool metadata.json >/dev/null
	python3 -m json.tool workbenches.example.json >/dev/null
	bash -n install.sh uninstall.sh create-shortcut.sh bin/workbench-launcher

install: check
	./install.sh

package: check
	rm -f $(PACKAGE)
	zip -9 $(PACKAGE) metadata.json extension.js workbenches.example.json README.md install.sh uninstall.sh create-shortcut.sh bin/workbench-launcher package.json tsconfig.json Makefile types/ambient.d.ts src/extension.ts

clean:
	rm -f $(PACKAGE)
