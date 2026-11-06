import sys
import warnings
warnings.filterwarnings("ignore")

try:
    import pydantic.v1.main
    import pydantic.v1.utils
    
    orig = pydantic.v1.utils.lenient_issubclass
    def safe_issubclass(cls, class_or_tuple):
        try:
            return isinstance(cls, type) and issubclass(cls, class_or_tuple)
        except TypeError:
            return False
            
    pydantic.v1.utils.lenient_issubclass = safe_issubclass
    pydantic.v1.main.lenient_issubclass = safe_issubclass
    
    import great_expectations as gx
    print("Great Expectations imported successfully!")
    print(f"GX Version: {gx.__version__}")
except Exception as e:
    import traceback
    traceback.print_exc()
