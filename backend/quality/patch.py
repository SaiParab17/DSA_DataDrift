import sys
import warnings
warnings.filterwarnings("ignore")

try:
    import pydantic.v1.main
    import pydantic.v1.utils
    
    orig = pydantic.v1.utils.lenient_issubclass
    def safe_issubclass(cls, class_or_tuple):
        try:
            return orig(cls, class_or_tuple)
        except TypeError:
            # Pydantic v1 expects True here for GX internals to pass class creation
            return True
            
    pydantic.v1.utils.lenient_issubclass = safe_issubclass
    pydantic.v1.main.lenient_issubclass = safe_issubclass
    
except ImportError:
    pass
