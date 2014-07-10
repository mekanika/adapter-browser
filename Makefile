REPORTER = spec
TESTFILES = $(shell find test/ -name '*.test.js')

install:
	@echo "Installing production"
	@npm install --production
	@echo "Install complete"

build: lint
	@NODE_ENV=test mocha --reporter dot $(TESTFILES)
	@browserify index.js -o dist/adapter-browser.js -s browser
	@uglifyjs dist/adapter-browser.js -m -c -o dist/adapter-browser.min.tmp
	@cat ./components/localforage/dist/localforage.min.js dist/adapter-browser.min.tmp > dist/adapter-browser.min.js
	@rm dist/adapter-browser.min.tmp

test:
	@NODE_ENV=test mocha \
		--reporter $(REPORTER) \
		$(TESTFILES)

lint:
	@echo "Linting..."
	@jshint \
		--config .jshintrc \
		*.js test/*.js

coverage:
	@echo "Generating coverage report.."
	@istanbul cover _mocha
	@echo "Done: ./coverage/lcov-report/index.html"

.PHONY: install lint test coverage
