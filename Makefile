run-local: styles
	python3 demo.py

styles:
	tools/dart-sass/sass -s compressed sass/styles.scss css/styles.css

BULMA_VERSION = "0.7.2"
get-bulma: tools/bulma
	mkdir -p tools
	rm -rf tools/bulma
	wget https://github.com/jgthms/bulma/releases/download/$(BULMA_VERSION)/bulma-$(BULMA_VERSION).zip
	unzip -d tools bulma-$(BULMA_VERSION).zip
	rm -rf bulma-$(BULMA_VERSION).zip
	rm -rf tools/__MACOSX
	mv tools/bulma-$(BULMA_VERSION) tools/bulma

DART_SASS_VERSION = "1.16.1"
get-sass: tools/dart-sass
	mkdir -p tools
	rm -rf tools/dart-sass
	wget https://github.com/sass/dart-sass/releases/download/$(DART_SASS_VERSION)/dart-sass-$(DART_SASS_VERSION)-linux-x64.tar.gz
	tar -C tools -xf dart-sass-$(DART_SASS_VERSION)-linux-x64.tar.gz
	rm -rf dart-sass-$(DART_SASS_VERSION)-linux-x64.tar.gz

